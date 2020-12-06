// const remote = require('electron')

const { contextBridge, ipcRenderer } = require('electron')

// message from main process
ipcRenderer.on('message', (event, arg) => {
  window.postMessage(arg, '*')
})

contextBridge.exposeInMainWorld(
  'electron', {
    sendMessage: (arg) => ipcRenderer.send('asynchronous-message', arg)
  }
)
