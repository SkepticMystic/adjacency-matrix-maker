import { settings } from "cluster";
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
  mainColourHue: number;
  mainColourSat: number;
  mainColourLight: number;
  backgroundColourHue: number;
  backgroundColourSat: number;
  backgroundColourLight: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mainColourHue: 100,
  mainColourSat: 100,
  mainColourLight: 50,
  backgroundColourHue: 10,
  backgroundColourSat: 10,
  backgroundColourLight: 50,
};

/// Source: https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0"); // convert to Hex and prefix "0" if needed
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    console.log("loading adjacency matrix maker plugin");

    await this.loadSettings();

    this.addRibbonIcon("dice", "Adjacency Matrix", this.addImage);

    this.addCommand({
      id: "adjacency-matrix",
      name: "Add image of adjacency matrix",
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

  addImage = async () => {
    const files: TFile[] = this.app.vault.getMarkdownFiles();

    const fileDataArr = [];
    for (let file of files) {
      const links = await this.app.metadataCache.getFileCache(file).links;
      if (links) {
        const noHeaderLinks = links.map((item) =>
          item.link.replace(/#.+/g, "")
        );
        fileDataArr.push([file.basename, noHeaderLinks]);
      } else {
        fileDataArr.push([file.basename, []]);
      }
    }
    const size = fileDataArr.length;
    const scale = size < 300 ? 8 : 2;

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
          cellColour = `hsl(${this.settings.backgroundColourHue}, ${this.settings.backgroundColourSat}%, ${this.settings.backgroundColourLight}%)`;
        } else {
          cellColour = `hsla(${this.settings.mainColourHue}, ${this.settings.mainColourSat}%, ${this.settings.mainColourLight}%, ${alpha})`;
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

    this.app.vault.createBinary(`/adj ${now}.png`, arrBuff);
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
    containerEl.createEl("h2", {
      text: "Settings for Adjacency Matrix Maker",
    });

    // Main colour picker
    const coloursDiv = containerEl.createDiv();
    const mainColourDiv = coloursDiv.createDiv();
    const mainColourPicker = mainColourDiv.createEl("input", { type: "color" });
    mainColourDiv.createEl("p", {
      text: "Main colour",
    });
    mainColourPicker.value = hslToHex(
      this.plugin.settings.mainColourHue,
      this.plugin.settings.mainColourSat,
      this.plugin.settings.mainColourLight
    );

    // Background colour picker
    const backgroundColourDiv = coloursDiv.createDiv();
    const backgroundColourPicker = backgroundColourDiv.createEl("input", {
      type: "color",
    });
    backgroundColourDiv.createEl("p", {
      text: "Background colour",
    });
    backgroundColourPicker.value = hslToHex(
      this.plugin.settings.backgroundColourHue,
      this.plugin.settings.backgroundColourSat,
      this.plugin.settings.backgroundColourLight
    );

    new Setting(containerEl)
      .setName("Main colour hue")
      .setDesc("Hue of the colour to use when two notes are linked")
      .addSlider((slider) =>
        slider
          .setLimits(0, 360, 1)
          .setValue(this.plugin.settings.mainColourHue)
          .onChange((value) => {
            this.plugin.settings.mainColourHue = value;
            this.plugin.saveData(this.plugin.settings);
            mainColourPicker.value = hslToHex(
              value,
              this.plugin.settings.mainColourSat,
              this.plugin.settings.mainColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Main colour saturation")
      .setDesc("Saturation of the colour to use when two notes are linked")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.mainColourSat)
          .onChange((value) => {
            this.plugin.settings.mainColourSat = value;
            this.plugin.saveData(this.plugin.settings);
            mainColourPicker.value = hslToHex(
              this.plugin.settings.mainColourHue,
              value,
              this.plugin.settings.mainColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Main colour light")
      .setDesc("Light of the colour to use when two notes are linked")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.mainColourLight)
          .onChange((value) => {
            this.plugin.settings.mainColourLight = value;
            this.plugin.saveData(this.plugin.settings);
            mainColourPicker.value = hslToHex(
              this.plugin.settings.mainColourHue,
              this.plugin.settings.mainColourSat,
              value
            );
          })
      );

    new Setting(containerEl)
      .setName("Background colour hue")
      .setDesc("Hue of the background colour")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.backgroundColourHue)
          .onChange((value) => {
            console.log(value);
            this.plugin.settings.backgroundColourHue = value;
            this.plugin.saveData(this.plugin.settings);
            backgroundColourPicker.value = hslToHex(
              value,
              this.plugin.settings.backgroundColourSat,
              this.plugin.settings.backgroundColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Background colour saturation")
      .setDesc("Saturation of the background colour")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.backgroundColourSat)
          .onChange((value) => {
            this.plugin.settings.backgroundColourSat = value;
            this.plugin.saveData(this.plugin.settings);
            backgroundColourPicker.value = hslToHex(
              this.plugin.settings.backgroundColourHue,
              value,
              this.plugin.settings.backgroundColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Background colour light")
      .setDesc("Light of the background colour")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.backgroundColourLight)
          .onChange((value) => {
            this.plugin.settings.backgroundColourLight = value;
            this.plugin.saveData(this.plugin.settings);
            backgroundColourPicker.value = hslToHex(
              this.plugin.settings.backgroundColourHue,
              this.plugin.settings.backgroundColourSat,
              value
            );
          })
      );
  }
}
