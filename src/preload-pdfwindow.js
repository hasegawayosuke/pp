const { contextBridge, ipcRenderer } = require('electron')

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  window.postMessage(arg, '*')
})

// message from main process
ipcRenderer.on('message', (event, arg) => {
  window.postMessage(arg, '*')
})

contextBridge.exposeInMainWorld(
  'electron', {
    sendMessage: (arg) => ipcRenderer.send('asynchronous-message', arg)
  }
)
