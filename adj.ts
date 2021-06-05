const files: [] = await app.vault.getMarkdownFiles();

const fileDataArr = files.map(async(file) => {
  const links = await app.metadataCache.getFileCache(file).links;
  if (links) {
    const noHeaderLinks = links.map((item) => item.link.replace(/#.+/g, ""));
    return [file.basename, noHeaderLinks];
  } else {
    return [file.basename, []];
  }
});

const size = fileDataArr.length;
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// imgData to Binary helper function
// Source: https://gist.github.com/borismus/1032746
function convertDataURIToBinary(dataURI) {
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

// function sumCols(arr) {
//   const result = arr.reduce((r, a) => {
//     a.forEach((b, i) => {
//       r[i] = (r[i] || 0) + b;
//     });
//     return r;
//   }, []);
//   return result;
// }

function sumRows(array: number[][]) {
  let result: number[] = [];
  array.forEach((row, i) => {
    row.reduce((a, b) => (result[i] = a + b));
  });
  return result;
}

// function roundNumber(num, dec) {
//     return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
// }

function normalise(array: number[]) {
  const max = Math.max(...array);
  return array.map((x) => x / max);
}

function createAdjMatrix(linksArray) {
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

function addImage(scale = 1) {
  // Canvas setup
  canvas.width = size * scale;
  canvas.height = size * scale;

  const adj = createAdjMatrix(fileDataArr);
  const normalisedRowSums = normalise(sumRows(adj));

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
  const arrBuff = convertDataURIToBinary(image.src);

  app.vault.createBinary(
    `/adj ${moment().format("YYYYMMDDHHmmSS")}.png`,
    arrBuff
  );
}

const scaleString = await tp.system.prompt(
  "Choose a scale for the image (it must be a multiple of 2, and 1 is also fine)",
  "1"
);
const scaleInt = parseInt(scaleString);
if (
  (typeof scaleInt === "number" && scaleInt % 2 === 0) ||
  (typeof scaleInt === "number" && scaleInt === 1)
) {
  addImage(scaleInt);
} else {
  return;
}
