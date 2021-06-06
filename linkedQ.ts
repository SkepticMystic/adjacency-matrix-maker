import { App, Modal, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

export default class MyPlugin extends Plugin {
  files = this.app.vault.getMarkdownFiles();

  linkedQ(from: TFile, to: TFile) {
    const fromLinkObjs = this.app.metadataCache
      .getFileCache(from)
      .links || [];
    const fromLinks = fromLinkObjs.map(linkObj => linkObj.link);
    if (fromLinks.includes(to.basename)) {
      return true;
    } else {
      return false;
    }
  }
}
