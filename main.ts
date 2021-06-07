import {
  App,
  debounce,
  Modal,
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
  backgroundColourHue: 30,
  backgroundColourSat: 20,
  backgroundColourLight: 50,
};

// Functions
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

function convertDataURIToBinary(dataURI: string) {
  const base64Index: number = dataURI.indexOf(";base64,") + ";base64,".length;
  const base64: string = dataURI.substring(base64Index);
  const raw = window.atob(base64);
  const rawLength = raw.length;
  let array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function sumRows(array: number[][]) {
  const result: number[] = [];
  array.forEach((row, i) => {
    row.reduce((a, b) => (result[i] = a + b));
  });
  return result;
}

function normalise(array: number[]) {
  const max = Math.max(...array);
  return array.map((x) => x / max);
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    console.log("Loading Adjacency Matrix Maker plugin");

    await this.loadSettings();

    this.addRibbonIcon("dice", "Adjacency Matrix", this.makeAdjacencyMatrix);

    this.addCommand({
      id: "adjacency-matrix",
      name: "Open Adjacency Matrix",
      callback: this.makeAdjacencyMatrix,
    });

    this.addSettingTab(new AdjacencyMatrixMakerSettingTab(this.app, this));

    this.registerCodeMirror((cm: CodeMirror.Editor) => {
      // console.log("codemirror", cm);
    });
  }

  // Does `from` have a link going to `to`?
  linkedQ(from: TFile, to: TFile) {
    const fromLinkObjs = this.app.metadataCache.getFileCache(from).links || [];
    const fromLinks = fromLinkObjs.map(
      (linkObj) => linkObj.link.replace(/#.+/g, "") || ""
    );
    return fromLinks.includes(to.basename);
  }

  populateAdjacencyMatrixArr(files: TFile[]) {
    const size = files.length;
    const adj: number[][] = [];

    for (let i = 0; i < size; i++) {
      adj.push([]);
      for (let j = 0; j < size; j++) {
        // 1 or 0 so that sumRows works (instead of true or false)
        adj[i][j] = this.linkedQ(files[i], files[j]) ? 1 : 0;
      }
    }
    return adj;
  }

  makeAdjacencyMatrix = async () => {
    const files: TFile[] = this.app.vault.getMarkdownFiles();
    const size = files.length;
    const scale = size < 50 ? 16 : size < 100 ? 8 : size < 200 ? 4 : 2;

    // Canvas setup
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = size * scale;
    canvas.height = size * scale;

    const adj = this.populateAdjacencyMatrixArr(files);
    const normalisedRowSums = normalise(sumRows(adj));

    // This for loop colours each cell
    for (let i = 0; i < size; i++) {
      // Where the alpha of that row is proportional to the number of coloured cells in that row
      /// Make the more "popular" notes pop
      const alpha = normalisedRowSums[i] / 1.5 + 0.33333333;

      for (let j = 0; j < size; j++) {
        // Position of the top-left corner of the next pixel
        const x = j * scale;
        const y = i * scale;
        let cellColour: string;

        // Change colour if the two notes are linked
        if (adj[i][j] === 0) {
          const bgH = this.settings.backgroundColourHue;
          const bgS = this.settings.backgroundColourSat;
          const bgL = this.settings.backgroundColourLight;
          cellColour = `hsl(${bgH}, ${bgS}%, ${bgL}%)`;
        } else {
          const mnH = this.settings.mainColourHue;
          const mnS = this.settings.mainColourSat;
          const mnL = this.settings.mainColourLight;
          cellColour = `hsla(${mnH}, ${mnS}%, ${mnL}%, ${alpha})`;
        }

        // Draw the cell
        ctx.beginPath();
        ctx.fillStyle = cellColour;
        ctx.fillRect(x, y, scale, scale);
      }
    }

    new MatrixModal(this.app, canvas, files, scale).open();
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

class MatrixModal extends Modal {
  private canvas: HTMLCanvasElement;
  private files: TFile[];
  private scale: number;

  constructor(
    app: App,
    canvas: HTMLCanvasElement,
    files: TFile[],
    scale: number
  ) {
    super(app);
    this.canvas = canvas;
    this.files = files;
    this.scale = scale;
  }

  onOpen() {
    const app = this.app;
    const scale = this.scale;
    const files = this.files;

    // Add the canvas to the modal
    let { contentEl } = this;
    contentEl.addClass("contentEl");
    const canvas = this.canvas;
    contentEl.appendChild(canvas);

    // Save image button
    const buttonRow = contentEl.createDiv({ cls: "matrixModalButtons" });
    const saveImageButton = buttonRow.createEl("button", {
      text: "Save Image",
    });

    // Tooltip
    /// TODO: The tooltip starts at the bottom left
    /// I can't get the tooltip to show if I append it to the canvas itself, but I seem to have found a workaround
    const tooltip = contentEl.createDiv({ cls: "adj-tooltip" });
    const tooltipText = tooltip.createSpan({ cls: "adj-tooltip-text" });

    // The same linkedQ function from the MyPlugin class
    function linkedQ(from: TFile, to: TFile) {
      const fromLinkObjs = app.metadataCache.getFileCache(from).links || [];
      const fromLinks = fromLinkObjs.map(
        (linkObj) => linkObj.link.replace(/#.+/g, "") || ""
      );
      return fromLinks.includes(to.basename);
    }

    function handleCanvasInteraction(e: MouseEvent) {
      let x = e.offsetX;
      let y = e.offsetY;

      // Convert coord to cell number
      const i = Math.round(x / scale - 0.5);
      const j = Math.round(y / scale - 0.5);
      // Pick the two files that cell refers to
      const fileI = files[i];
      const fileJ = files[j];

      // If hovering over linked notes, show tooltip, and move it there
      if (linkedQ(fileJ, fileI)) {
        tooltip.addClass("show");
        tooltip.style.transform = `translate(${x + 15}px, ${
          y - canvas.height - 80
        }px)`;
        tooltipText.innerText = `${fileJ.basename} → ${fileI.basename}`;
      } else {
        // Hide the tooltip
        tooltip.removeClass("show");
      }
    }

    canvas.addEventListener(
      "mousemove",
      debounce(handleCanvasInteraction, 20, true)
    );

    function saveCanvasAsImage() {
      let image = new Image();
      image.src = canvas.toDataURL();
      const arrBuff = convertDataURIToBinary(image.src);

      // Add the current datetime to the image name
      const now = window.moment().format("YYYYMMDDHHmmSS");
      // Save image to root. This could be improved to let the user choose the path
      app.vault.createBinary(`/adj ${now}.png`, arrBuff);
    }

    saveImageButton.addEventListener("click", saveCanvasAsImage);
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

class AdjacencyMatrixMakerSettingTab extends PluginSettingTab {
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
    containerEl.createEl("p", {
      text: "You currently can't use the colour pickers to actually choose the colours. It is just to show the result.",
    });

    const coloursDiv = containerEl.createDiv();

    // Main colour picker
    const mainColourDiv = coloursDiv.createDiv();
    mainColourDiv.createEl("h4", {
      text: "Main colour",
    });
    const mainColourPicker = mainColourDiv.createEl("input", { type: "color" });
    // Update value based on chosen slider settings
    mainColourPicker.value = hslToHex(
      this.plugin.settings.mainColourHue,
      this.plugin.settings.mainColourSat,
      this.plugin.settings.mainColourLight
    );

    // Background colour picker
    const backgroundColourDiv = coloursDiv.createDiv();
    backgroundColourDiv.createEl("h4", {
      text: "Background colour",
    });
    const backgroundColourPicker = backgroundColourDiv.createEl("input", {
      type: "color",
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
          .setLimits(0, 360, 1)
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
