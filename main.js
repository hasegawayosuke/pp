'use strict'
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const parseOption = (argv) => {
  if (argv === undefined) argv = process.argv
  if (path.basename(argv[0]).toLowerCase().startsWith('electron')) {
    argv = argv.slice(2)
  } else {
    argv = argv.slice(1)
  }
  const opt = {}
  argv.forEach(arg => {
    switch (arg) {
      case '--force':
        opt.force = true
        break
      default:
        if (arg.endsWith('.pdf')) {
          opt.pdf = arg
        } else {
          opt.json = arg
        }
        break
    }
  })
  if (opt.force || !config.pdffile) {
    if (opt.json) {
      const json = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), opt.json), 'utf8'))
      Object.keys(config).forEach(key => {
        if (json[key] !== undefined) {
          if (key === 'pdffile') {
            config[key] = path.resolve(process.cwd(), json[key])
          } else {
            config[key] = json[key]
          }
        }
      })
    } else if (opt.pdf) {
      config.pdffile = path.resolve(process.cwd(), opt.pdf)
    }
  }
}

const loadConfig = () => {
  try {
    parseOption()
    if (config.pdffile === undefined || config.pdffile === '') {
      const filename = dialog.showOpenDialogSync({
        title: 'pp - ファイルを開く',
        filters: [
          {
            name: 'PDFファイル(*.pdf)',
            extensions: ['pdf']
          },
          {
            name: 'pp構成ファイル(*.json)',
            extensions: ['json']
          },
          {
            name: '全てのファイル(*.*)',
            extensions: ['*']
          }
        ]
      })
      if (!(filename instanceof Array) || !filename[0]) {
        app.quit()
        return
      }
      if (filename[0].toLocaleLowerCase().endsWith('.pdf')) {
        config.pdffile = filename[0]
      } else if (filename[0].toLocaleLowerCase().endsWith('.json')) {
        parseOption(['', filename[0]])
      }
    }
  } catch (e) {
    console.error(e)
    app.quit()
  }
}

const createCtlWindow = () => {
  const window = new BrowserWindow({
    width: config.ctlwindow.width,
    height: config.ctlwindow.height,
    x: config.ctlwindow.left,
    y: config.ctlwindow.top,
    webPreferences: {
      contextIsolation: true,
      preload: path.resolve(__dirname, 'src', 'preload-ctlwindow.js')
    }
  })
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('message', { msg: 'notes', notes: config.notes || {} })
  })
  window.loadFile(path.resolve(__dirname, 'src', 'ctlwindow.html'))
  return window
}

const createPdfWindow = () => {
  const window = new BrowserWindow({
    width: config.pdfwindow.width,
    height: config.pdfwindow.height,
    x: config.pdfwindow.left,
    y: config.pdfwindow.top,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.resolve(__dirname, 'src', 'preload-pdfwindow.js')
    }
  })
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('message', { msg: 'load', filename: config.pdffile })
  })
  window.loadFile(path.resolve(__dirname, 'src', 'pdfwindow.html'))
  return window
}

let pdfWindow
let ctlWindow

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  loadConfig()
  pdfWindow = createPdfWindow()
  ctlWindow = createCtlWindow()
  Menu.setApplicationMenu(null)
  ctlWindow.on('closed', (evt) => {
    ctlWindow = undefined
    if (pdfWindow) pdfWindow.close()
  })
  pdfWindow.on('closed', (evt) => {
    pdfWindow = undefined
    if (ctlWindow) ctlWindow.close()
  })
  // pdfWindow.openDevTools()
  // ctlWindow.openDevTools()
})

ipcMain.on('asynchronous-message', (event, arg) => {
  const target = event.sender.id === pdfWindow.webContents.id ? ctlWindow : (event.sender.id === ctlWindow.webContents.id ? pdfWindow : null)
  if (typeof arg === 'object' && target) {
    target.webContents.send('message', arg)
  }
})

ipcMain.on('synchronous-message', (event, arg) => {
  event.returnValue = 'pong'
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
