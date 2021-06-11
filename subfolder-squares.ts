import { App } from "obsidian";

class MyPlugin extends Plugin {
  app: App;
  onLoad() {
    let files = this.app.vault.getMarkdownFiles();
    let paths = files.map((file) => file.path);

    const fullFolders = paths.map((path) =>
      path.match(/(.+)\//) ? path.match(/(.+)\//)[1] : "/"
    );


    // This seems to be promising, but needs some work
    /// The transission from 21 to 22 is 'different', which is technically correct, but doesn't capture the level of the change
    /// 21: "Logic/Propositional Logic/With another"
    /// 22: "Logic/Propositional Logic/Extra Prop"

    /// "Logic/Quantifiers/For All"
    /// And
    /// "Logic/Propositional Logic/Extra Prop"
    /// Are also 'different', but the second more so than the first

    let changeArr = [];
    for (let i = 0; i < fullFolders.length - 1; i++) {

      const current = fullFolders[i] === "/" ? "@@UNIQUE_ROOT" : fullFolders[i] + "/";
      const next = fullFolders[i + 1] === "/" ? "@@UNIQUE_ROOT" : fullFolders[i + 1] + "/";

      if (current === next) {
        changeArr.push("same");
      } else if (current.includes(next)) {
        changeArr.push("shallower");
      } else if (next.includes(current)) {
        changeArr.push("deeper");
      } else {
        changeArr.push("different");
      }
    }

    /// Different approach:

    let firstAndSubPaths = paths.map((path) => {
      const firstFolder = path.match(/[^\/]+/)[0];
      const allFolders = path.match(/(.+)\//) ? path.match(/(.+)\//)[1] : "/";
      return {
        firstFolder,
        allFolders,
      };
    });

    function groupBy(xs: {}[], key: string) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }

    let grouped = groupBy(firstAndSubPaths, "firstFolder");
    // console.log(grouped);

    function indicesOfChange(arr: []) {
      const newValueAt = [0];
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1]) {
          newValueAt.push(i);
        }
      }
    }

    let groupedArr = Object.values(grouped);
    let groupedSubfoldersArr: string[][] = groupedArr.map((arr: []) => {
      return arr.map((obj: {}) => obj.allFolders);
    });

    let nestLevelInfo = groupedSubfoldersArr.map((arr) => {
      return arr.map((str) => {
        return (str.match(/\//g) || []).length;
      });
    });
  }
}
