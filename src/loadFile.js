const { dialog } = require('electron').remote
const fs = require('fs')

const loadFile = () => {
    return dialog.showOpenDialog({properties: ['openFile'],filters: [
        {name: 'Text', extensions: ['txt']}
    ] }).then(async (response) => {
        if (!response.canceled) {
           const data = await fs.promises.readFile(response.filePaths[0])
           return data.toString().trim().split('\n')
        } else {
          console.log("no file selected");
        }
    });
}

export default loadFile