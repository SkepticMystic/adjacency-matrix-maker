import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: "default",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    console.log("loading plugin");

    await this.loadSettings();

    this.addRibbonIcon("dice", "Sample Plugin", () => {
      new Notice("This is a notice!");
    });

    this.addStatusBarItem().setText("Status Bar Text");

    this.addCommand({
      id: "add-image",
      name: "Add Image",
      callback: this.addImage,
    });

    this.addSettingTab(new SampleSettingTab(this.app, this));

    this.registerCodeMirror((cm: CodeMirror.Editor) => {
      console.log("codemirror", cm);
    });
  }

  // Functions
  convertDataURIToBinary(dataURI: string) {
    let base64Index: number = dataURI.indexOf(";base64,") + ";base64,".length;
    let base64: string = dataURI.substring(base64Index);
    let raw = window.atob(base64);
    let rawLength = raw.length;
    let array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  }

  sumRows(array: number[][]) {
    let result: number[] = [];
    array.forEach((row, i) => {
      row.reduce((a, b) => (result[i] = a + b));
    });
    return result;
  }

  normalise(array: number[]) {
    const max = Math.max(...array);
    return array.map((x) => x / max);
  }

  createAdjMatrix(linksArray) {
    const adj: number[][] = [];
    for (let i = 0; i < linksArray.length; i++) {
      adj.push([]);
      for (let j = 0; j < linksArray.length; j++) {
        // If note i links to note j, adj[i][j] = 1
        adj[i][j] = linksArray[i][1].includes(linksArray[j][0]) ? 1 : 0;
      }
    }
    return adj;
  }

  addImage = async (scale = 1) => {
    const files: TFile[] = this.app.vault.getMarkdownFiles();

    const fileDataArr = [];
    for(let file of files) {
      const links = await this.app.metadataCache.getFileCache(file).links;
      if (links) {
        const noHeaderLinks = links.map((item) =>
          item.link.replace(/#.+/g, "")
        );
        fileDataArr.push([file.basename, noHeaderLinks]);
      } else {
        fileDataArr.push([file.basename, []]);
      }
    };
    const size = fileDataArr.length;
    // console.log(size);

    // Canvas setup
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = size * scale;
    canvas.height = size * scale;

    const adj = this.createAdjMatrix(fileDataArr);
    const normalisedRowSums = this.normalise(this.sumRows(adj));

    for (let i = 0; i < size; i++) {
      const alpha = normalisedRowSums[i] / 1.5 + 0.33333333;

      for (let j = 0; j < size; j++) {
        // Position of the top-left corner of the next pixel
        const x = j * scale;
        const y = i * scale;
        let cellColour: string;

        if (adj[i][j] === 0) {
          cellColour = "#1D2021";
        } else {
          cellColour = `rgba(254, 104, 37, ${alpha})`;
        }

        ctx.beginPath();
        ctx.fillStyle = cellColour;
        ctx.fillRect(x, y, scale, scale);
      }
    }

    let image = new Image();
    image.src = canvas.toDataURL();
    const arrBuff = this.convertDataURIToBinary(image.src);

    const now = window.moment().format("YYYYMMDDHHmmSS");

    this.app.vault.createBinary(
      `/adj ${now}.png`,
      arrBuff
    );
  };

  onunload() {
    console.log("unloading plugin");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    let { contentEl } = this;
    contentEl.setText("Woah!");
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

    new Setting(containerEl)
      .setName("Setting #1")
      .setDesc("It's a secret")
      .addText((text) =>
        text
          .setPlaceholder("Enter your secret")
          .setValue("")
          .onChange(async (value) => {
            console.log("Secret: " + value);
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
