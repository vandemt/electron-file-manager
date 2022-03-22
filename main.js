const { app, BrowserWindow, Menu, screen, dialog, accelerator, WebContents, webContents, MenuItem, ipcRenderer} = require('electron')
const path = require('path')
const fs = require('fs')

const { exec, execSync, spawn, execFileSync } = require("child_process");

const ipcMain = require('electron').ipcMain
const nativeTheme = require('electron').nativeTheme

const usb = require('usb');

const windows = new Set();

const webusb = new usb.WebUSB({
    allowAllDevices:true
})

const showDevices = async () => {
    const devices = await webusb.getDevices();
    const text = devices.map(d => `${d.vendorId}\t${d.productId}\t${d.serialNumber || '<no serial>'}`);
    text.unshift('VID\tPID\tSerial\n-------------------------------------');

    console.log('running showdevices ' + text)

    windows.forEach(win => {
        if (win) {
            console.log(text)
            win.webContents.send('devices', text.join('\n'));
        }
    });
}


// RETURN FORMATED FILE/FOLDER SIZE
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.0).toFixed(1) + byteUnits[i];

}

// FILE PROPERTIES WINDOW
function createPropertiesWindow(filename) {

    let bounds = screen.getPrimaryDisplay().bounds;
    let x = bounds.x + ((bounds.width - 400) / 2);
    let y = bounds.y + ((bounds.height - 400) / 2);

    const win = new BrowserWindow({
        width: 500,
        height: 500,
        backgroundColor: '#2e2c29',
        x: x,
        y: y,
        frame: true,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            // nativeWindowOpen: false,
            preload: path.join(__dirname, 'properties.js'),
        },
    })

    // LOAD INDEX FILE
    win.loadFile('src/properties.html')


    win.once('ready-to-show', () => {

        win.title = path.basename(filename)
        win.removeMenu()
        win.show()

        let stats = fs.statSync(filename)

        cmd = "xdg-mime query filetype '" + filename + "'"
        let exec_mime = execSync(cmd).toString()

        // BUILD PROPERTIES
        let name = path.basename(filename)
        let parent_folder = path.basename(path.dirname(filename))
        let type = exec_mime
        let contents = '0 items, totalling 0 MB'
        let size = ''
        let accessed = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.atime)
        let modified = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)
        let created = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.ctime)

        if (type == true) {

            // type = 'Folder'
            size = ''

        } else {

            // type = 'File'
            size = get_file_size(stats.size)

        }

        let file_properties = {
            name: name,
            parent_folder: parent_folder,
            type: type,
            contents: contents,
            size: size,
            accessed: accessed,
            modified: modified,
            created: created
        }

        console.log('send file properties')
        win.send('file_properties', file_properties)

    })

    // CLOSE WINDOW
    ipcMain.on('close_properties_window', () => {
        var window = BrowserWindow.getFocusedWindow();
        window.close()
    })
}


// GET FILE PROPERTIES
ipcMain.on('get_file_properties', (e, filename) => {

    createPropertiesWindow(filename)

})


// GET DEVICES USING GIO COMMAND LINE UTILITY
ipcMain.on('get_gio_devices', (e) => {

    let output = ''

    // GET GIO LIST
    let cmd = "gio mount --list -i"
    let gio_device = exec(cmd)

    console.log('running get gio cmd ' + cmd)

    // GET DATA FROM COMMAND
    // let output = ''
    gio_device.stdout.setEncoding('utf8')
    gio_device.stdout.on('data', (data) => {

        // console.log('running get_gio_devces ')
        // e.sender.send('gio_devices', data)
        output = output + data

    })

    gio_device.stderr.on('data', function (res) {

        console.log('running get_gio_device error ')
        e.sender.send('gio_devices', res)

    })

    gio_device.on('exit', (data) => {
        console.log('running get_gio_devces exit')
        e.sender.send('gio_devices', output)
        console.log('running get_gio_devces ' + output)
    })


})


// MOUNT GIO DEVICE
ipcMain.on('mount_gio', (e, data) => {

    let uuid = data.uuid

    let cmd = "gio mount " + uuid
    console.log('gio mount cmd ' + cmd)

    let mount_gio = exec(cmd)

    mount_gio.stdout.on('data', (res) => {
        console.log('device mounted ' + res)
        e.sender.send('gio_mounted', res)
    })

    mount_gio.stderr.on('data', (res) => {
        console.log('device already connected ' + res)
        e.sender.send('gio_mounted', res)
    })

    mount_gio.on('exit', (code) => {
        console.log('exit code ' + code)
    })

})

// MONITOR GIO DEVICES
ipcMain.on('monitor_gio', (e, data) => {

    let cmd = 'gio mount -o'
    let monitor_gio = exec(cmd)

    console.log('starting gio monitor ' + cmd)

    //
    monitor_gio.stdout.on('data', (res) => {
        console.log('gio monitor' + res)
        e.sender.send('gio_monitor', res)
    })

    monitor_gio.stderr.on('data', (res) => {
        console.log('gio monitor error ' + res)
        e.sender.send('gio_monitor', res)
    })




})

// LIST FILES USING GIO
ipcMain.on('get_gio_files', (e, data) => {

    console.log(data)

    let files = exec('gio list ' + data)

    // STDOUT
    files.stdout.on('data', (res) => {
        console.log(res)
        e.sender.send('gio_files', {res, data})
    })

    // S
    files.stderr.on('data', (data) => {
        console.log(data)
        e.sender.send('gio_files', data)
    })


})

// GET GZIP SIZE
ipcMain.on('get_uncompressed_size', (e, filename) => {

    // RUN GZIP -L TO GET FILE SIZE. ONLY WORKS ON GZIPED FILES
    let cmd = "gzip -l '" + filename + "' | awk 'FNR==2{print $2}'"
    let size = 0

    try {
        size = execSync(cmd)
    } catch (err) {

    }

    console.log('uncompressed size ' + size)
    e.sender.send('uncompressed_size', size)

})


// GET FILES
ipcMain.on('get_files', (e, dir) => {

    console.log('directory ' + dir)
    // let dirents = fs.readdirSync(args.dir)
    // if (dirents.length > 0) {
    //     e.sender.send('files', dirents)
    // }
    fs.readdir(dir, (err, dirents) => {
        e.sender.send('files', dirents)
    })
})


// GNOME-DISKS
ipcMain.on('gnome_disks', (e, args) => {
    let cmd = 'gnome-disks'
    exec(cmd)
})

// DISK USAGE ANAYLIZER
ipcMain.on('dua', (e, args) => {
    let cmd = 'baobab "' + args.dir + '"'
    exec(cmd)
})


// GET FILE SIZE. todo: this is just formating and the name needs to change
ipcMain.on('get_file_size', (e, args) => {
    e.sender.send('file_size', {href: args.href, size: args.size})
})


// GET FOLDER SIZE
ipcMain.on('get_folder_size', (e , args) => {

    let stats = fs.statSync(args.href)

    if (stats.isDirectory() === true) {

        // GET FOLDER SIZE
        cmd = "cd '" + args.href + "'; du -Hs"
        du = exec(cmd)
        du.stdout.on('data', function (res) {

            // SEND FOLDER SIZE TO RENDERER
            let size = parseInt(res.replace('.', '') * 1024)
            e.sender.send('folder_size', {href: args.href, size: size})

        })

    }
})


// GET DISK SPACE
// CREATE DF ARRAY
ipcMain.on('get_disk_space', (e, href) => {

    console.log('directory ' + href.href)

    // if (href.href.indexOf('gvfs') === -1) {

        // RUN DISK FREE COMMAND
        let cmd = 'df "' + href.href + '"'
        let child = exec(cmd)

        // console.log(cmd)

        child.stdout.on("data", (res) => {

            // CREATE ARRAY FROM RESULT
            res = res.split('\n')

            if (res.length > 0) {

                let df = []

                // CREATE OPTIONS OBJECT
                let options = {
                    disksize: 0,
                    usedspace: 0,
                    availablespace:0,
                    foldersize:0,
                    foldercount:0,
                    filecount:0
                }

                let res1 = res[1].split(' ')

                res1.forEach((size, i) => {

                    // 0 DISK
                    // 6 SIZE OF DISK
                    // 7 USED SPACE
                    // 8 AVAILABLE SPACE
                    // 10 PERCENTAGE USED
                    // 11 CURRENT DIR

                    switch (i) {
                        case 1:
                            // console.log('found 6 ' + res1[i])
                            options.disksize = get_file_size(size * 1024)
                            break;
                        case 2:
                            options.usedspace = get_file_size(size * 1024)
                            break;
                        case 3:
                            options.availablespace = get_file_size(size * 1024)
                            break;
                    }

                })



                cmd = 'cd "' + href.href + '"; du -s'
                du = exec(cmd)

                console.log('command ' + cmd)

                du.stdout.on('data', function (res) {

                    let size = parseInt(res.replace('.', '') * 1024)
                    size = get_file_size(size)

                    options.foldersize = size

                    options.foldercount = href.folder_count
                    options.filecount = href.file_count

                    df.push(options)

                    // SEND DISK SPACE
                    e.sender.send('disk_space', df)

                })

            }

        })

    // }
})


// ADD FILES TO COPY ARRAY
copy_files_arr = []
ipcMain.on('add_copy_files', function( e, data ) {

    copy_files_arr = data
    console.log('copy files array ' + copy_files_arr.length)

})

// SEND COPY FILES ARRAY
ipcMain.on('get_copy_files', (e, destination_folder) => {

    e.sender.send('copy_files', {copy_files_arr : copy_files_arr, destination_folder: destination_folder})

    // CLEAR COPY FILES ARRAY
    copy_files_arr = []
})


// CREATE MAIN WINDOW
function createWindow() {

    let displayToUse = 0
    let lastActive = 0
    let displays = screen.getAllDisplays()

    // Single Display
    if (displays.length === 1) {
        displayToUse = displays[0]
    }

    // Multi Display
    else {

        // if we have a last active window, use that display for the new window
        if (!displayToUse && lastActive) {
            displayToUse = screen.getDisplayMatching(lastActive.getBounds());
        }

        // fallback to primary display or first display
        if (!displayToUse) {
            displayToUse = screen.getPrimaryDisplay() || displays[3];
        }

    }

    let options = {
        minWidth:1024,
        minHeight:600,
        width: 1600,
        height: 768,
        backgroundColor: '#2e2c29',
        x:displayToUse.bounds.x + 50,
        y:displayToUse.bounds.y + 50,
        frame: false,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            // nativeWindowOpen: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    }


    const win = new BrowserWindow(options)

    // LOAD INDEX FILE
    win.loadFile('src/index.html')

    // RELOAD WINDOW
    ipcMain.on('reload',function(e){
        win.loadFile('src/index.html')
    })


    // MAXAMIZE WINDOW
    ipcMain.on('maximize', () => {
        win.maximize()
    })


    // MINIMIZE WINDOW
    ipcMain.on('minimize', () => {
        win.minimize()
    })

    // CLOSE WINDOW
    ipcMain.on('close', () => {
        var window = BrowserWindow.getFocusedWindow();
        window.close()
    })

    // GO BACK
    ipcMain.on('go_back', function(e, msg) {
        console.log('running go back from main ')
        win.webContents.goBack()
    })


    showDevices()

    // win.webContents.on('get_devices', (e, devicelist, callback) => {
    //     console.log('device lengh list ' + devicelist.length)
    // })

}


// CREATE CHILD WINDOW
function createChildWindow() {
    chileWindow = new BrowserWindow({

        minWidth:1024,
        minHeight:600,
        width: 1600,
        height: 768,
        backgroundColor: '#2e2c29',
        x:displayToUse.bounds.x + 50,
        y:displayToUse.bounds.y + 50,
        frame: false,
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            enableRemoteModule: false, // turn off remote
            nodeIntegrationInWorker: false,
            preload: path.join(__dirname, 'preload.js'),
        },

    })

    // LOAD INDEX FILE
    chileWindow.loadFile('src/index.html')
}

// win.loadURL('file://' + __dirname + '/src/backup.html')


// const contents = win.webContents
// console.log(contents)


//   const ses = win.webContents.session
//   const ses = session.fromPartition('persist:name')


//   win.once('ready-to-show',() => {
//       win.show()
//   })

// // TESTING ??
// if (process.argv[2]) {
//     start_path = process.argv[2]
//     console.log(start_path)
//     win.webContents.send('start_path', start_path)
//   }


  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light'
    } else {
      nativeTheme.themeSource = 'dark'
    }
    return nativeTheme.shouldUseDarkColors
  })

  ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system'
  })


  // // START OF SESSION MANAGEMENT
  // const ses = win.webContents.session

  // ses.fromPartion('partition', true)




  /////////////////////////////////////////////////////////

//   win.once('ready-to-show', () => {
//     console.log('ready-to-show')
//     win.show();
//   });

//   win.on('closed', () => {
//     windows.delete(win);
//     win = null;
//   });

app.whenReady().then(() => {

    webusb.addEventListener('connect', showDevices);
    webusb.addEventListener('disconnect', showDevices);

    createWindow()

    // ACTIVATE EVENTS GO HERE?
    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

})

//   windows.add(win);

    // const ses = session.fromPartition('persist:name')

    // console.log('all running session ' + session.defaultSession.serviceWorkers.getAllRunning())

    // session.defaultSession.serviceWorkers.on('console-message', (event, messageDetails) => {
    //     console.log(
    //       'Got service worker message',
    //       messageDetails,
    //       'from',
    //       session.defaultSession.serviceWorkers.getFromVersionID(messageDetails.versionId)
    //     )
    // })

    // console.log(ses.getCacheSize())

    // win.setFullScreen = true
    // win.webContents.openDevTools()

    // win.maximize()


    // // RELOAD WINDOW
    // ipcMain.on('reload',function(e){
    //     win.loadFile('src/index.html')
    // })


    // // MAXAMIZE WINDOW
    // ipcMain.on('maximize', () => {
    //     win.maximize()
    // })


    // // MINIMIZE WINDOW
    // ipcMain.on('minimize', () => {
    //     win.minimize()
    // })

    // // CLOSE WINDOW
    // ipcMain.on('close', () => {
    //     win.close()
    // })


  // let displays = screen.getAllDisplays()

  // displays.forEach(element => {
  //   console.log(element)
  // });


  // let externalDisplay = displays.find((display) => {
  //   return display.bounds.x !== 0 || display.bounds.y !== 0
  // })

  // if (externalDisplay) {
  //   win = new BrowserWindow({
  //     x: externalDisplay.bounds.x + 50,
  //     y: externalDisplay.bounds.y + 50
  //   })
  // }

  // Menu.setApplicationMenu(menu);


// }

process.on('uncaughtException', function (err) {
  console.log(err);
})



// TEMPLATE MENU
function add_templates_menu(menu, e, args){

    let template_menu = menu.getMenuItemById('templates')

    let templates = fs.readdirSync('assets/templates')
    templates.forEach((file,idx) => {

        template_menu.submenu.append(new MenuItem({
            label: file.replace(path.extname(file),''),
            click: () => {
                e.sender.send('create_file_from_template', {file: file})
            }
        }));
    })
}

// LAUNCHER MENU
let launcher_menu
function add_launcher_menu(menu, e, args) {
    launcher_menu = menu.getMenuItemById('launchers')
    if (args.length > 0) {
        for(let i = 0; i < args.length; i++) {
            launcher_menu.submenu.append(new MenuItem({
                label: args[i].name,
                click: () => {

                    console.log(e)

                    // e.sender.send('', args[i].exec)
                    e.sender.send('context-menu-command', 'open_with_application', args[i].exec)

                    let cmd = 'xdg-mime default ' + args[i].desktop + ' ' + args[i].mimetype
                    console.log(cmd)
                    execSync(cmd)

                    // e.sender.send('open_with')

                }
            }))
        }
    }
}


// MAIN MENU
ipcMain.on('show-context-menu', (e, options) => {

    // console.log(data)

  console.log('running main menu')
  const template = [
    {
        label: 'New Folder',
        accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
        click: () => {
          e.sender.send('context-menu-command', 'new_folder')
        }
    },
    {
        id: 'templates',
        label: 'New Document',
        submenu: [
        {
            label: 'Open Templates Folder',
            click: () => {
                e.sender.send('context-menu-command', 'open_templates_folder'
            ),
            {
                type: 'separator'
            }
        }
        }],
    },
    {
        type: 'separator'
    },
    {
        label: 'Paste',
        accelerator: process.platform === 'darwin' ? 'CTRL+V' : 'CTRL+V',
        click: () => {
          e.sender.send('context-menu-command', 'paste')
        }
    },
    {
        label: 'Select all',
        click: () => {
          e.sender.send('context-menu-command', 'select_all')
        }
    },
    {
        type: 'separator'
    },
    {
      label: 'Terminal',
      click: () => {
        e.sender.send(
          'context-menu-command', 'menu_terminal'
        )
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Properties',
      click:()=>{
        // createPropertiesWindow()
        e.sender.send('context-menu-command', 'props')
      }
    },
    {
        type: 'separator'
    },
    {
      label: 'Show Hidden',
      type: 'checkbox'

    },
    // { label: 'Terminal', type: 'button', checked: true }
  ]

    // CALL BUILD TEMPLATE. CREATE NEW FILES
    let menu = Menu.buildFromTemplate(template)


    // ADD TEMPLATES
    add_templates_menu(menu, e, options)


    // SHOW MENU
    menu.popup(BrowserWindow.fromWebContents(e.sender))

})


// CREATE NEW WINDOW
ipcMain.on('new_window', function (e, args) {
    createWindow()
})

// GET HOME FOLDER
ipcMain.on('get_home_folder',function(e) {

    e.sender.send('home_folder', app.getPath('home'))

})


// FIND ON PAGE
ipcMain.on('find', function (e, args) {
  console.log('running find')
  // const requestId = win.webContents.findInPage(text, args);
})

// // CONFIRM DELETE FOLDER DIALOG
// ipcMain.on('confirm_delete_folder', function (e, msg) {
//   // e.preventDefault()

//   let res = dialog.showMessageBoxSync(null, {

//     // defaultId: 0,
//     type: 'warning',
//     title: 'Warning',
//     buttons: ['Delete', 'Cancel'],
//     // type: 'question',
//     message: 'This will permanetly delete your stuff. \n Are you sure you want to continue',
//     detail: msg

//   })

//   if (res == 0) {
//     e.sender.send('delete_folder_confirmed', res)
//   }

// })




// FOLDERS MENU
ipcMain.on('show-context-menu-directory', (e, args) => {

  const template1 = [
    {
      label: 'Open with Code',
      click: () => {
        e.sender.send('context-menu-command', 'vscode')
      }
    },
    {
        type: 'separator'
    },
    {
        label: 'Open',
        click: () => {
            e.sender.send('open')
        }
    },
    {
      label: 'Open in new window',
      click: () => {
        e.sender.send('context-menu-command', 'open_in_new_window')
      }
    },
    {
        id: 'launchers',
        label: 'Open with',
        submenu: []
    },
    {
        type: 'separator'
    },
    {
        id: 'templates',
        label: 'New Document',
        submenu: [
        {
            label: 'Open Templates Folder',
            click: () => {
                e.sender.send('context-menu-command', 'open_templates_folder'
            ),
            {
                type: 'separator'
            }
        }
    },],
    },
    {
        label: 'New Folder',
        accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
        click: () => {
            e.sender.send('context-menu-command', 'new_folder')
        }
    },
    {
      type: 'separator'
    },
    {
        label: 'Add to workspace',
        click: () => {
            e.sender.send('open')
        }
    },
    {
        type: 'separator'
    },
    {
      label: 'Cut',
      click: () => {
        e.sender.send('context-menu-command', 'cut')
      }
    },
    {
      label: 'Copy',
      accelerator: process.platform === 'darwin' ? 'CTRL+C' : 'CTRL+C',
      click: () => {
        e.sender.send('context-menu-command', 'copy')
      }
    },
    {
        label: 'Paste',
        accelerator: process.platform === 'darwin' ? 'CTRL+V' : 'CTRL+V',
        click: () => {
          e.sender.send('context-menu-command', 'paste')
        }
    },


    // {
    //   label: 'Paste file into folder',
    //   click: () => {
    //     e.sender.send('context-menu-command', 'paste_file')
    //   }
    // },
    {
      label: '&Rename',
      accelerator: process.platform === 'darwin' ? 'F2' : 'F2',
      click: () => {
        e.sender.send('context-menu-command', 'rename')
      }
    },
    {
        type: 'separator'
    },
    {
      label: 'Compress',
      click: () => {
        e.sender.send('context-menu-command', 'compress_folder')
      }
    },
    {
        type: 'separator'
    },
    {
        label: 'Delete',
        click: () => {
          // e.sender.send('context-menu-command', 'delete_folder')
          e.sender.send('context-menu-command', 'delete')
        }
      },
      {
        type: 'separator'
    },
    {
      label: 'Open in terminal',
      click: () => {
        e.sender.send('context-menu-command', 'open_folder_in_terminal')
      }
    },
    {
        type: 'separator'
    },
    {
        label: 'Properties',
        click:()=>{
            // createPropertiesWindow()
            e.sender.send('context-menu-command', 'props')
        }
    },
    {
        type: 'separator'
    }
    // {
    //   label: 'Move to trash',
    //   click: () => {
    //     e.sender.send('context-menu-command', 'move_to_trash')
    //   }
    // },
  ]

    const menu1 = Menu.buildFromTemplate(template1)

    // ADD TEMPLATES
    add_templates_menu(menu1, e, args)

    // ADD LAUNCHER MENU
    add_launcher_menu(menu1, e, args)


    menu1.popup(BrowserWindow.fromWebContents(e.sender))

})



// FILES MENU
ipcMain.on('show-context-menu-files', (e, args) => {

    console.log(e + ' ' + args)

  // console.log('running main menu')
  const template = [
    {
        label: 'Open with Code',
        click: () => {
          e.sender.send('context-menu-command', 'vscode')
        }
    },
    {
          type: 'separator'
    },
    {
        id: 'launchers',
        label: 'Open with',
        // click: () => {
        //     e.sender.send('open_with')
        // },
        submenu: []
    },
    {
        type: 'separator'
    },
    {
        label: '&New Folder',
        accelerator: process.platform === 'darwin' ? 'CTRL+SHIFT+N' : 'CTRL+SHIFT+N',
        click: () => {
          e.sender.send('context-menu-command', 'new_folder')
        }
    },
    {
        label: 'Cut',
        click: () => {
          e.sender.send('context-menu-command', 'cut')
        }
    },
    {
        label: 'Copy',
        accelerator: process.platform === 'darwin' ? 'CTRL+C' : 'CTRL+C',
        click: () => {
          e.sender.send('context-menu-command', 'copy')
        }
    },
    {
        type: 'separator'
    },
    {
        id: 'templates',
        label: 'New Document',
        submenu: [
        {
            label: 'Open Templates Folder',
            click: () => {
                e.sender.send('context-menu-command', 'open_templates_folder'
            ),
            {
                type: 'separator'
            }
        }
      }],
    },

    {
      label: '&Rename',
      accelerator: process.platform === 'darwin' ? 'F2' : 'F2',
      click: () => { e.sender.send('context-menu-command', 'rename') }
    },
    {
        type: 'separator'
    },
    {
      label: '&Extract',
      accelerator: process.platform === 'darwin' ? 'ALT+E' : 'ALT+E',
      click: () => { e.sender.send('context-menu-command', 'extract_here') }
    },
    {
        label: 'Compress',
        click: () => {
          e.sender.send(
            'context-menu-command', 'compress_folder'
          )
        }
    },
    {
      type: 'separator'
    },
    // {
    //   label: 'Trash',
    //   click: () => {
    //     e.sender.send(
    //       'context-menu-command', 'trash_file'
    //     )
    //   }
    // },
    // {
    //   type: 'separator'
    // },
    {
      label: 'Delete file',
      click: () => {
        // e.sender.send('context-menu-command', 'delete_file')
        e.sender.send('context-menu-command', 'delete')
      }
    },
    {
        type: 'separator'
    },
    {
      label: 'Terminal',
      click: () => {
        e.sender.send(
          'context-menu-command', 'menu_terminal'
        )
      }
    },
    {
        type: 'separator'
    },
    {
        label: 'Properties',
        click:()=>{
            // createPropertiesWindow()
            e.sender.send('context-menu-command', 'props')
        }
    },
  ]


    let menu = Menu.buildFromTemplate(template)

    // ADD TEMPLATES
    add_templates_menu(menu, e, args)


    // ADD LAUNCHER MENU
    add_launcher_menu(menu, e, args)


    menu.popup(BrowserWindow.fromWebContents(e.sender))

})


// CREATE NEW WINDOW
// ipcMain.on('new_window', function (e, args) {
//     // createWindow()
//     window.open('src/index.html')
//     console.log('running new window')
// })


// GET HOME FOLDER
ipcMain.on('get_home_folder',function(e){

  e.sender.send('home_folder', app.getPath('home'))

})


// FIND ON PAGE
ipcMain.on('find', function (e, args) {
  console.log('running find')
  // const requestId = win.webContents.findInPage(text, args);
})


// CONFIRM MOVE FOLDER DIALOG
ipcMain.on('confirm_move', function (e, msg) {


    let res = dialog.showMessageBoxSync(null, {

        title: 'Warning',
        buttons: ['Yes', 'Cancel'],
        message: 'Are you sure you want to move?',
        detail: msg

    })

    // IF RESPONSE IS 0 THEN MOVE CONFIRMED. I KNOW ITS BACKWARDS
    if (res == 0) {

        e.sender.send('move_confirmed', res)
    }

})


// CONFIRM OVERWRITE DIALOG
ipcMain.on('confirm_overwrite', function (e, msg) {
    // e.preventDefault()

    let res = dialog.showMessageBoxSync(null, {

        // defaultId: 0,
        type: 'warning',
        title: 'Warning',
        buttons: ['Ok', 'Cancel'],
        // type: 'question',
        message: 'Are you sure you want to overwrite your stuff',
        detail: msg

    })

    // console.log(res)

    if (res == 0) {

        e.sender.send('overwrite_confirmed', res)
    } else {
        e.sender.send('overwrite_canceled')
    }

})








// // CONFIRM DELETE FOLDER DIALOG
// ipcMain.on('confirm_delete_folder', function (e, msg) {
//   // e.preventDefault()

//   let res = dialog.showMessageBoxSync(null, {

//     // defaultId: 0,
//     type: 'warning',
//     title: 'Warning',
//     buttons: ['Delete', 'Cancel'],
//     // type: 'question',
//     message: 'This will permanetly delete your stuff. \n Are you sure you want to continue',
//     detail: msg

//   })

//   // console.log(res)

//   if (res == 0) {

//     e.sender.send('delete_folder_confirmed', res)
//   }

// })


// CONFIRM DELETE FILES DIALOG
ipcMain.on('confirm_file_delete', function (e, target_name) {
  // e.preventDefault()

  let res = dialog.showMessageBoxSync(null, {

    type: 'warning',
    title: 'Warning',
    buttons: ['Delete', 'Cancel'],
    // type: 'question',
    normalizeAccessKeys: true,
    message: 'Are you sure you want to permanently delete',
    detail: target_name

  })

  console.log(res)

  if (res == 0) {
    e.sender.send('delete_file_confirmed', res)
  }

  if(res == 1){
    e.sender.send('clear_selected_files')
  }



})



// // CONFIRM OVERWRITE FILE DIALOG
// ipcMain.on('confirm_move_overwrite', function (e, msg) {
//     // e.preventDefault()

//     let res = dialog.showMessageBoxSync(null, {

//         // defaultId: 0,
//         type: 'warning',
//         title: 'Warning',
//         buttons: ['Ok', 'Cancel'],
//         // type: 'question',
//         message: 'Are you sure you want to overwrite your stuff',
//         detail: msg

//     })

//     // console.log(res)

//     if (res == 0) {

//         e.sender.send('move_overwrite_confirmed', res)
//     }

// })




/////////////////////////////////////////////////////////////////////////////////////

// app.whenReady().then(() => {
//   createWindow()
//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {

//         createWindow()

//         const ses = session.fromPartition('persist:name')
//         console.log(ses.getUserAgent())

//     }
//   })
// })


ipcMain.on('ondragstart', (e, filePath) => {
  e.sender.startDrag({
    file: path.join(__dirname, filePath),
    icon: iconName,
  })
})


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})




ipcMain.on('quit', () => {
    app.quit()
})


ipcMain.on('reload',()=> {

  // let folder = localStorage.getItem('folder')

})


// ipcMain.on('ondragstart', (event, filePath) => {
//   event.sender.startDrag({
//     file: filePath,
//     icon: '/path/to/icon.png'
//   })
// })












// ipc.on('btn_getdir', function (event, arg) {
//   win.webContents.send('targetPriceVal', arg)
// })


// ipc.on('update-notify-value', function (event, arg) {
//   win.webContents.send('targetPriceVal', arg)
// })