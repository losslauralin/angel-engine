import type { IUpdateInfo } from "update-electron-app";
import type { DesktopUpdateDownloadedEvent } from "../shared/desktop-window";

import { app, autoUpdater, BrowserWindow, dialog } from "electron";
import log from "electron-log/main";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";

import { DESKTOP_UPDATE_DOWNLOADED_CHANNEL } from "../shared/desktop-window";
import { translate } from "./platform/i18n";

const updateRepository = "AkaraChen/angel-engine";
const supportsAutoUpdates =
  process.platform === "darwin" || process.platform === "win32";

let updateDownloaded = false;
let checkingForUpdates = false;
let userInitiatedCheck = false;

export function configureAutoUpdates() {
  log.initialize();

  autoUpdater.on("checking-for-update", () => {
    checkingForUpdates = true;
  });
  autoUpdater.on("update-not-available", () => {
    checkingForUpdates = false;
    if (userInitiatedCheck) {
      userInitiatedCheck = false;
      void showUpdateMessage({
        detail: translate("updates.upToDateDetail", {
          version: app.getVersion(),
        }),
        message: translate("updates.upToDate"),
      });
    }
  });
  autoUpdater.on("update-available", () => {
    checkingForUpdates = false;
  });
  autoUpdater.on("error", (error) => {
    checkingForUpdates = false;
    if (userInitiatedCheck) {
      userInitiatedCheck = false;
      void showUpdateMessage({
        detail:
          error instanceof Error
            ? error.message
            : translate("updates.checkFailedDetail"),
        message: translate("updates.checkFailed"),
        type: "error",
      });
    }
  });

  updateElectronApp({
    logger: log,
    notifyUser: true,
    onNotifyUser: notifyUpdateDownloaded,
    updateInterval: "5 minutes",
    updateSource: {
      repo: updateRepository,
      type: UpdateSourceType.ElectronPublicUpdateService,
    },
  });

  app.on("browser-window-focus", () => {
    checkForUpdatesInBackground();
  });
  app.on("activate", () => {
    checkForUpdatesInBackground();
  });
}

export function checkForUpdatesInBackground() {
  if (
    !supportsAutoUpdates ||
    !app.isPackaged ||
    checkingForUpdates ||
    updateDownloaded
  ) {
    return;
  }

  try {
    checkingForUpdates = true;
    autoUpdater.checkForUpdates();
  } catch (error) {
    checkingForUpdates = false;
    log.warn("Could not check for updates.", error);
  }
}

export function checkForUpdatesFromMenu() {
  if (updateDownloaded) {
    void showUpdateMessage({
      buttons: [
        translate("updates.restartAndInstall"),
        translate("common.cancel"),
      ],
      detail: translate("updates.downloadedDetail"),
      message: translate("updates.downloaded"),
    }).then(({ response }) => {
      if (response === 0) {
        installDownloadedUpdate();
      }
    });
    return;
  }

  if (!app.isPackaged) {
    notifyUpdateDownloaded({
      releaseName: translate("updates.devPreviewVersion", {
        version: app.getVersion(),
      }),
      releaseNotes: translate("updates.devPreviewNotes"),
    });
    return;
  }

  if (!supportsAutoUpdates) {
    void showUpdateMessage({
      detail: translate("updates.unsupportedPlatformDetail"),
      message: translate("updates.unsupportedPlatform"),
    });
    return;
  }

  if (checkingForUpdates) {
    void showUpdateMessage({
      detail: translate("updates.checkingDetail"),
      message: translate("updates.checking"),
    });
    return;
  }

  try {
    userInitiatedCheck = true;
    checkingForUpdates = true;
    autoUpdater.checkForUpdates();
  } catch (error) {
    userInitiatedCheck = false;
    checkingForUpdates = false;
    void showUpdateMessage({
      detail:
        error instanceof Error
          ? error.message
          : translate("updates.checkFailedDetail"),
      message: translate("updates.checkFailed"),
      type: "error",
    });
    log.warn("Could not check for updates.", error);
  }
}

export function installDownloadedUpdate() {
  if (!updateDownloaded) return;
  autoUpdater.quitAndInstall();
}

function notifyUpdateDownloaded(
  info: Pick<IUpdateInfo, "releaseName" | "releaseNotes">,
) {
  updateDownloaded = true;
  userInitiatedCheck = false;
  checkingForUpdates = false;

  const event: DesktopUpdateDownloadedEvent = {
    releaseName: info.releaseName,
    releaseNotes:
      typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
  };

  for (const window of BrowserWindow.getAllWindows()) {
    sendUpdateDownloaded(window, event);
  }
}

function sendUpdateDownloaded(
  window: BrowserWindow,
  event: DesktopUpdateDownloadedEvent,
) {
  if (window.isDestroyed()) return;

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", () => {
      if (!window.isDestroyed()) {
        window.webContents.send(DESKTOP_UPDATE_DOWNLOADED_CHANNEL, event);
      }
    });
    return;
  }

  window.webContents.send(DESKTOP_UPDATE_DOWNLOADED_CHANNEL, event);
}

async function showUpdateMessage({
  buttons,
  detail,
  message,
  type = "info",
}: {
  buttons?: string[];
  detail: string;
  message: string;
  type?: "error" | "info";
}) {
  const options = {
    buttons: buttons ?? [translate("common.close")],
    defaultId: 0,
    detail,
    message,
    noLink: true,
    title: translate("updates.title"),
    type,
  };
  const parentWindow =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

  return parentWindow !== undefined
    ? dialog.showMessageBox(parentWindow, options)
    : dialog.showMessageBox(options);
}
