use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use crate::config::{ClientOptions, ClientProtocol, StartConversationRequest};
use crate::core::{AngelClientCore, process_log};
use crate::error::{ClientError, ClientResult};
use crate::event::{ClientLogKind, ClientUpdate};
use crate::settings::{
    AvailableModeSettingSnapshot, AvailablePermissionModeSettingSnapshot, ModelListSettingSnapshot,
    ReasoningLevelSettingSnapshot, ThreadSettingsSnapshot,
};
use crate::snapshot::{RuntimeSnapshot, TurnSnapshot};
use crate::{ClientCommandResult, ElicitationSnapshot, ResumeConversationRequest, ThreadEvent};

pub struct AngelClient {
    child: Child,
    child_stdin: ChildStdin,
    lines: Receiver<ProcessLine>,
    core: AngelClientCore,
    runtime_model_catalog_command: Option<String>,
    runtime_model_catalog: RuntimeModelCatalogCache,
}

impl AngelClient {
    pub fn spawn(options: ClientOptions) -> ClientResult<Self> {
        let runtime_model_catalog_command =
            (options.protocol == ClientProtocol::CodexAppServer).then(|| options.command.clone());
        let mut command = spawn_command(&options.command);
        command
            .args(&options.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        for variable in &options.environment {
            command.env(&variable.name, &variable.value);
        }
        let mut child = command.spawn()?;

        let child_stdin = child
            .stdin
            .take()
            .ok_or_else(|| ClientError::InvalidInput {
                message: "runtime process did not expose stdin".to_string(),
            })?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| ClientError::InvalidInput {
                message: "runtime process did not expose stdout".to_string(),
            })?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| ClientError::InvalidInput {
                message: "runtime process did not expose stderr".to_string(),
            })?;
        let (tx, rx) = mpsc::channel();
        spawn_line_reader(stdout, tx.clone(), ProcessLine::Stdout);
        spawn_line_reader(stderr, tx, ProcessLine::Stderr);

        Ok(Self {
            child,
            child_stdin,
            lines: rx,
            core: AngelClientCore::new(options),
            runtime_model_catalog_command,
            runtime_model_catalog: RuntimeModelCatalogCache::NotLoaded,
        })
    }

    pub fn snapshot(&self) -> crate::ClientSnapshot {
        self.core.snapshot()
    }

    pub fn initialize(&mut self) -> ClientResult<ClientUpdate> {
        let result = self.core.initialize()?;
        let mut update = self.send_command_result(result)?;
        update.merge(self.wait_for_runtime()?);
        Ok(update)
    }

    pub fn initialize_and_start(
        &mut self,
        request: StartConversationRequest,
    ) -> ClientResult<ClientCommandResult> {
        let mut update = self.initialize()?;
        let mut result = self.start_conversation(request)?;
        update.merge(result.update);
        result.update = update;
        Ok(result)
    }

    pub fn start_conversation(
        &mut self,
        request: StartConversationRequest,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.start_conversation(request)?;
        self.finish_conversation_command(result)
    }

    pub fn resume_conversation(
        &mut self,
        request: ResumeConversationRequest,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.resume_conversation(request)?;
        self.finish_conversation_command(result)
    }

    pub fn read_conversation(
        &mut self,
        conversation_id: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.read_conversation(conversation_id)?;
        self.finish_conversation_command(result)
    }

    pub fn send_text(
        &mut self,
        conversation_id: impl Into<String>,
        text: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.send_text(conversation_id, text)?;
        self.flush_command_result(result)
    }

    pub fn send_thread_event(
        &mut self,
        conversation_id: impl Into<String>,
        event: ThreadEvent,
    ) -> ClientResult<ClientCommandResult> {
        let conversation_id = conversation_id.into();
        let focused_turn_id = self.focused_turn_id(&conversation_id);
        let result = self
            .core
            .send_thread_event(conversation_id, event, focused_turn_id)?;
        self.flush_command_result(result)
    }

    pub fn ask_text(
        &mut self,
        conversation_id: impl Into<String>,
        text: impl Into<String>,
    ) -> ClientResult<TurnSnapshot> {
        let conversation_id = conversation_id.into();
        let result = self.send_text(conversation_id.clone(), text)?;
        let turn_id = result.turn_id.ok_or_else(|| ClientError::InvalidInput {
            message: "turn command did not produce a turn id".to_string(),
        })?;
        let _ = self.wait_for_turn_terminal(&conversation_id, &turn_id)?;
        self.core
            .turn_snapshot(&conversation_id, &turn_id)
            .ok_or_else(|| ClientError::InvalidInput {
                message: format!("turn {turn_id} was not found after completion"),
            })
    }

    pub fn wait_for_turn_terminal(
        &mut self,
        conversation_id: &str,
        turn_id: &str,
    ) -> ClientResult<ClientUpdate> {
        let mut update = ClientUpdate::default();
        while !self.core.turn_is_terminal(conversation_id, turn_id) {
            update.merge(self.next_update(None)?.ok_or(ClientError::ChannelClosed)?);
        }
        Ok(update)
    }

    pub fn next_update(&mut self, timeout: Option<Duration>) -> ClientResult<Option<ClientUpdate>> {
        let line = match timeout {
            Some(timeout) => match self.lines.recv_timeout(timeout) {
                Ok(line) => line,
                Err(mpsc::RecvTimeoutError::Timeout) => return Ok(None),
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err(ClientError::ChannelClosed);
                }
            },
            None => self.lines.recv().map_err(|_| ClientError::ChannelClosed)?,
        };

        let mut update = match line {
            ProcessLine::Stdout(line) => match self.core.receive_json_line(&line) {
                Ok(update) => update,
                Err(ClientError::Json(_)) => process_log(ClientLogKind::ProcessStdout, line),
                Err(error) => return Err(error),
            },
            ProcessLine::Stderr(line) => process_log(ClientLogKind::ProcessStderr, line),
        };
        let sent = self.flush_update(&update)?;
        update.merge(sent);
        Ok(Some(update))
    }

    pub fn drain(&mut self, timeout: Duration) -> ClientResult<ClientUpdate> {
        let mut update = ClientUpdate::default();
        while let Some(next) = self.next_update(Some(timeout))? {
            update.merge(next);
        }
        Ok(update)
    }

    pub fn open_elicitations(
        &self,
        conversation_id: &str,
    ) -> ClientResult<Vec<ElicitationSnapshot>> {
        self.core.open_elicitations(conversation_id)
    }

    pub fn thread_settings(
        &self,
        conversation_id: impl Into<String>,
    ) -> ClientResult<ThreadSettingsSnapshot> {
        self.core.thread_settings(conversation_id)
    }

    pub fn reasoning_level(
        &self,
        conversation_id: impl Into<String>,
    ) -> ClientResult<ReasoningLevelSettingSnapshot> {
        self.core.reasoning_level(conversation_id)
    }

    pub fn model_list(
        &self,
        conversation_id: impl Into<String>,
    ) -> ClientResult<ModelListSettingSnapshot> {
        self.core.model_list(conversation_id)
    }

    pub fn available_modes(
        &self,
        conversation_id: impl Into<String>,
    ) -> ClientResult<AvailableModeSettingSnapshot> {
        self.core.available_modes(conversation_id)
    }

    pub fn permission_modes(
        &self,
        conversation_id: impl Into<String>,
    ) -> ClientResult<AvailablePermissionModeSettingSnapshot> {
        self.core.permission_modes(conversation_id)
    }

    pub fn set_model(
        &mut self,
        conversation_id: impl Into<String>,
        model: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.set_model(conversation_id, model)?;
        self.flush_command_result(result)
    }

    pub fn set_mode(
        &mut self,
        conversation_id: impl Into<String>,
        mode: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.set_mode(conversation_id, mode)?;
        self.flush_command_result(result)
    }

    pub fn set_permission_mode(
        &mut self,
        conversation_id: impl Into<String>,
        mode: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.set_permission_mode(conversation_id, mode)?;
        self.flush_command_result(result)
    }

    pub fn set_reasoning_level(
        &mut self,
        conversation_id: impl Into<String>,
        level: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        let result = self.core.set_reasoning_level(conversation_id, level)?;
        self.flush_command_result(result)
    }

    pub fn set_reasoning_effort(
        &mut self,
        conversation_id: impl Into<String>,
        effort: impl Into<String>,
    ) -> ClientResult<ClientCommandResult> {
        self.set_reasoning_level(conversation_id, effort)
    }

    pub fn close(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }

    fn focused_turn_id(&self, conversation_id: &str) -> Option<String> {
        self.snapshot()
            .conversations
            .into_iter()
            .find(|conversation| conversation.id == conversation_id)
            .and_then(|conversation| conversation.focused_turn_id)
    }

    fn hydrate_runtime_model_catalog(&mut self, conversation_id: &str) -> ClientResult<()> {
        if !self.core.needs_runtime_model_catalog(conversation_id)? {
            return Ok(());
        }

        let Some(catalog) = self.runtime_model_catalog().cloned() else {
            return Ok(());
        };

        self.core
            .hydrate_model_catalog_from_runtime_debug(conversation_id, &catalog)
    }

    fn runtime_model_catalog(&mut self) -> Option<&serde_json::Value> {
        if matches!(
            self.runtime_model_catalog,
            RuntimeModelCatalogCache::NotLoaded
        ) {
            self.runtime_model_catalog = self
                .runtime_model_catalog_command
                .as_deref()
                .and_then(load_runtime_model_catalog)
                .map(RuntimeModelCatalogCache::Loaded)
                .unwrap_or(RuntimeModelCatalogCache::Unavailable);
        }

        match &self.runtime_model_catalog {
            RuntimeModelCatalogCache::Loaded(catalog) => Some(catalog),
            RuntimeModelCatalogCache::NotLoaded | RuntimeModelCatalogCache::Unavailable => None,
        }
    }

    fn wait_for_runtime(&mut self) -> ClientResult<ClientUpdate> {
        let mut update = ClientUpdate::default();
        let mut auth_sent = false;
        loop {
            match self.snapshot().runtime {
                RuntimeSnapshot::Available { .. } => return Ok(update),
                RuntimeSnapshot::AwaitingAuth { methods }
                    if self.core.auto_authenticate() && !auth_sent =>
                {
                    let method = methods
                        .first()
                        .ok_or_else(|| ClientError::InvalidInput {
                            message: "runtime requested auth without advertising a method"
                                .to_string(),
                        })?
                        .id
                        .clone();
                    auth_sent = true;
                    let auth = self.core.authenticate(method)?;
                    update.merge(self.send_command_result(auth)?);
                }
                RuntimeSnapshot::Faulted { code, message, .. } => {
                    return Err(ClientError::RuntimeFaulted { code, message });
                }
                _ => update.merge(self.next_update(None)?.ok_or(ClientError::ChannelClosed)?),
            }
        }
    }

    fn wait_for_conversation_idle(&mut self, conversation_id: &str) -> ClientResult<ClientUpdate> {
        let mut update = ClientUpdate::default();
        while !self.core.conversation_is_idle(conversation_id) {
            update.merge(self.next_update(None)?.ok_or(ClientError::ChannelClosed)?);
        }
        Ok(update)
    }

    fn finish_conversation_command(
        &mut self,
        result: ClientCommandResult,
    ) -> ClientResult<ClientCommandResult> {
        let mut result = self.flush_command_result(result)?;
        if let Some(conversation_id) = result.conversation_id.clone() {
            result
                .update
                .merge(self.wait_for_conversation_idle(&conversation_id)?);
            result.update.merge(self.drain(Duration::from_millis(150))?);
            self.hydrate_runtime_model_catalog(&conversation_id)?;
        }
        Ok(result)
    }

    fn flush_command_result(
        &mut self,
        mut result: ClientCommandResult,
    ) -> ClientResult<ClientCommandResult> {
        let sent = self.flush_update(&result.update)?;
        result.update.merge(sent);
        Ok(result)
    }

    fn send_command_result(&mut self, result: ClientCommandResult) -> ClientResult<ClientUpdate> {
        Ok(self.flush_command_result(result)?.update)
    }

    fn flush_update(&mut self, update: &ClientUpdate) -> ClientResult<ClientUpdate> {
        for outbound in &update.outgoing {
            writeln!(self.child_stdin, "{}", outbound.line)?;
        }
        if !update.outgoing.is_empty() {
            self.child_stdin.flush()?;
        }
        Ok(ClientUpdate::default())
    }
}

fn spawn_command(program: &str) -> Command {
    #[cfg(not(windows))]
    {
        Command::new(program)
    }
    #[cfg(windows)]
    {
        // Runtime CLIs are frequently installed as `.cmd`/`.bat` shims (for
        // example by pnpm/npm). `std::process::Command` only appends `.exe`
        // when given a bare program name, so a bare name that resolves to a
        // `.cmd` shim fails with "program not found". Resolve the program
        // against `PATH`/`PATHEXT` ourselves and pass the full path; std then
        // detects the `.cmd`/`.bat` extension and runs it through `cmd /C`.
        let mut cmd = Command::new(resolve_windows_program(program));
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
}

/// Resolve a bare program name to an executable path on Windows.
///
/// Programs that already contain a directory separator or a file extension
/// are returned unchanged so `std` can apply its own `.cmd`/`.bat` handling.
/// Bare names are searched in `PATH` using the `PATHEXT` extension list,
/// mirroring the resolution that the `which` crate performs for availability
/// checks. If nothing is found, the original name is returned and
/// `std::process::Command` surfaces the familiar "program not found" error
/// for genuinely missing tools.
#[cfg(windows)]
fn resolve_windows_program(program: &str) -> String {
    use std::path::Path;

    let path = Path::new(program);
    if path.extension().is_some() || path.components().count() > 1 {
        return program.to_string();
    }

    let path_env = match std::env::var("PATH") {
        Ok(value) => value,
        Err(_) => return program.to_string(),
    };
    let pathext = std::env::var("PATHEXT").unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".to_string());

    resolve_windows_program_in(
        program,
        path_env.split(';').filter(|dir| !dir.is_empty()),
        pathext.split(';').filter(|ext| !ext.is_empty()),
    )
    .map_or_else(|| program.to_string(), std::convert::identity)
}

/// Pure lookup core for [`resolve_windows_program`], separable from the process
/// environment so it can be unit tested without mutating global `PATH`.
///
/// Returns `dir/{program}{ext}` for the first `PATH` directory whose
/// `{program}{ext}` (for some `PATHEXT` extension) exists as a file. Empty
/// `PATHEXT` entries are skipped to avoid matching the pnpm/npm bare
/// extension-less shell shim, which `std::process::Command` cannot launch
/// directly (it errors with "not a valid Win32 application"); this mirrors the
/// resolution performed by the `which` crate used for availability checks.
#[cfg(windows)]
fn resolve_windows_program_in<'a, D, E>(program: &str, dirs: D, exts: E) -> Option<String>
where
    D: IntoIterator<Item = &'a str>,
    E: IntoIterator<Item = &'a str>,
{
    use std::path::Path;

    let ext_list: Vec<&str> = exts.into_iter().collect();

    for dir in dirs {
        if dir.is_empty() {
            continue;
        }
        for ext in &ext_list {
            if ext.is_empty() {
                continue;
            }
            let candidate = Path::new(dir).join(format!("{program}{ext}"));
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().into_owned());
            }
        }
    }

    None
}

fn load_runtime_model_catalog(command: &str) -> Option<serde_json::Value> {
    let output = spawn_command(command)
        .args(["debug", "models"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    serde_json::from_slice(&output.stdout).ok()
}

enum RuntimeModelCatalogCache {
    NotLoaded,
    Unavailable,
    Loaded(serde_json::Value),
}

impl Drop for AngelClient {
    fn drop(&mut self) {
        self.close();
    }
}

enum ProcessLine {
    Stdout(String),
    Stderr(String),
}

fn spawn_line_reader<R, F>(reader: R, tx: mpsc::Sender<ProcessLine>, wrap: F)
where
    R: io::Read + Send + 'static,
    F: Fn(String) -> ProcessLine + Send + 'static + Copy,
{
    thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            if tx.send(wrap(line)).is_err() {
                break;
            }
        }
    });
}

#[cfg(all(test, windows))]
mod tests {
    use super::resolve_windows_program_in;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn scratch() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0) as u64;
        let seq = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("angel-engine-client-spawn-{nanos}-{seq}"));
        fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn prefers_cmd_shim_over_bare_launcher_in_path() {
        // pnpm/npm ship both a bare extension-less shell launcher and a
        // `.CMD` shim for the same program. Windows cannot launch the bare
        // launcher via `std::process::Command`, so resolution must pick the
        // `.CMD` shim, mirroring `which`.
        let dir = scratch();
        fs::write(dir.join("codex"), "#!/bin/sh\n").expect("write bare");
        fs::write(dir.join("codex.CMD"), "@echo off\n").expect("write cmd");
        fs::write(dir.join("codex.ps1"), "# ps1\n").expect("write ps1");

        let dir_str = dir.to_string_lossy().into_owned();
        let dirs = [dir_str.as_str()];
        let exts = [".COM", ".EXE", ".BAT", ".CMD", ".VBS"];
        let resolved = resolve_windows_program_in("codex", dirs.into_iter(), exts.into_iter())
            .expect("should resolve");

        assert_eq!(
            resolved,
            dir.join("codex.CMD").to_string_lossy().into_owned(),
            "must prefer the .CMD shim over the bare launcher"
        );
    }

    #[test]
    fn respects_pathext_order() {
        let dir = scratch();
        fs::write(dir.join("qodercli.BAT"), "@echo bat\n").expect("write bat");
        fs::write(dir.join("qodercli.CMD"), "@echo cmd\n").expect("write cmd");

        let dir_str = dir.to_string_lossy().into_owned();
        let dirs = [dir_str.as_str()];

        let bat_first =
            resolve_windows_program_in("qodercli", dirs.into_iter(), [".BAT", ".CMD"].into_iter())
                .expect("should resolve");
        assert_eq!(
            bat_first,
            dir.join("qodercli.BAT").to_string_lossy().into_owned(),
            "earlier PATHEXT extensions win"
        );

        let cmd_first =
            resolve_windows_program_in("qodercli", dirs.into_iter(), [".CMD", ".BAT"].into_iter())
                .expect("should resolve");
        assert_eq!(
            cmd_first,
            dir.join("qodercli.CMD").to_string_lossy().into_owned(),
            "order flips with PATHEXT"
        );
    }

    #[test]
    fn returns_none_when_no_shim_exists() {
        let dir = scratch();
        let dir_str = dir.to_string_lossy().into_owned();
        let dirs = [dir_str.as_str()];
        let exts = [".CMD", ".EXE"];
        assert_eq!(
            resolve_windows_program_in("absent-tool", dirs.into_iter(), exts.into_iter()),
            None,
            "missing programs must not resolve"
        );
    }

    #[test]
    fn scans_multiple_path_directories_in_order() {
        let first = scratch();
        let second = scratch();
        // Only the second directory has the shim.
        fs::write(second.join("kimi.CMD"), "@echo kimi\n").expect("write cmd");

        let first_str = first.to_string_lossy().into_owned();
        let second_str = second.to_string_lossy().into_owned();
        let dirs = [first_str.as_str(), second_str.as_str()];
        let exts = [".CMD"];
        let resolved = resolve_windows_program_in("kimi", dirs.into_iter(), exts.into_iter())
            .expect("should resolve from second dir");
        assert_eq!(
            resolved,
            second.join("kimi.CMD").to_string_lossy().into_owned(),
            "must keep searching subsequent PATH entries"
        );
    }

    #[test]
    fn skips_empty_pathext_entries() {
        // The pnpm bare launcher should never win, even if PATHEXT contains an
        // empty entry (e.g. from malformed ";;" sequences).
        let dir = scratch();
        fs::write(dir.join("gemini"), "#!/bin/sh\n").expect("write bare");
        // Make a real `.CMD` so the resolution still succeeds instead of
        // accidentally matching the bare launcher.
        fs::write(dir.join("gemini.CMD"), "@echo gemini\n").expect("write cmd");
        let dir_str = dir.to_string_lossy().into_owned();
        let dirs = [dir_str.as_str()];
        let exts = ["", ".CMD"];
        let resolved = resolve_windows_program_in("gemini", dirs.into_iter(), exts.into_iter())
            .expect("should resolve via .CMD");
        assert_eq!(
            resolved,
            dir.join("gemini.CMD").to_string_lossy().into_owned(),
            "empty PATHEXT entries must not match the bare launcher"
        );
    }
}

// `spawn_command` and its Windows helpers are compiled away on non-Windows
// targets; this dummy keeps a non-Windows test run green and documents that
// the Windows-specific tests live in the `tests` module above.
#[cfg(all(test, not(windows)))]
mod tests_non_windows {
    #[test]
    fn spawn_command_path_helper_compiles() {
        // `spawn_command` is compiled away on non-Windows; nothing to assert.
    }
}
