
const {BrowserWindow, getCurrentWindow, globalShortcut, ipcRenderer, contextBridge, Menu, shell, ipcMain, app, MenuItem, menu, TouchBarSegmentedControl, desktopCapturer, clipboard, nativeImage } = require('electron')
const fs = require('fs');
const stat = require('fs')
const watch = require('fs')
const url = require('url')
const path = require('path')
const { exec, execSync, spawn, execFileSync } = require("child_process");
const Mousetrap = require('mousetrap');
const os = require('os');
const { dirname, basename, normalize } = require('path');
const Chart = require('chart.js')
const DragSelect = require('dragselect')
const mime = require('mime-types')
const open = require('open')
const readline = require('readline');


// const ds = new DragSelect({})


// ARRAYS
let chart_labels = []
let chart_data = []
let directories = []
let files = []

// HISTORY OBJECT
class history {
    dir
    idx
}

// FILE OBJECT
class fileinfo {

    filename
    is_dir
    dir
    extension
    size
    is_hidden
    filecount
    mtime
    ctime
    count
    is_sym_link
    idx

}

class selected_file_obj {

    card_id
    source

}

// ITEM OPTIONS
class card_options {

    id = 0
    href = ''
    image = ''
    linktext = ''
    description = ''
    extra = ''
    is_directory = false
}

let options = {
    sort: 1,
    search: ''
}

// todo: chec if were still using this
let prev_target = '';
let target = '';

// ACTIVE LINK BEING HOVERED OVER FOR CONTEXT MENU
// todo: this should replace source and target i think. needs review
let active_href = '';

// USE VAR GLOBAL
// USE LET INSIDE FUNCTIONS TO REDECLARE VARIABLE
let source = '';
let card_id = 0;
let mode = 0;

// PROGRESS VARS
let intervalid = 0;

// GLOBAL VARS
// HISTORY ARRAY
let history_arr = []
let files_arr = []

// SELECTED FILES ARRAY
let selected_files = []
let find_files_arr = []

// CUT / COPY
let state = 0;
let cut_files = 0;


let prev_card
let destination

// COUNTERS FOR NAVIGATION
let nc = 1
let nc2 = 0
let adj = 0
let is_folder_card = 1

// FOLDER / FILE COUNTERS
let folder_count = 1
let hidden_folder_count = 1
let file_count = 1
let hidden_file_count = 1

// PAGING VARIABLES
let watch_count = 0
let pagesize = 1000
let page = 1

let start_path = ''


let main_view = document.getElementById('main_view')
let progress = document.getElementById('progress')

ipcRenderer.on('updatetheme', (e, theme) => {

    console.log('theme', theme)

    if (theme == 'dark') {
        body.dataset.theme = 'dark'
        document.documentElement.dataset.theme('dark');
    } else if (theme == 'light') {
        document.documentElement.dataset.theme('light');
    }

})

// ON START PATH
ipcRenderer.on('start_path', (e, res) => {
    if (res) {
        start_path = res
    }
})

// ON NOTIFICATION
ipcRenderer.on('notification', (e, msg) => {
    notification(msg)
})

// UPDATE CARD
ipcRenderer.on('update_card', (e, href) => {
    // console.log('updating card')
    try {
        update_card(href)
    } catch (err) {

    }

})

// UPDATE CARDS
ipcRenderer.on('update_cards', (e) => {

    // console.log('updating cards')
    let view = document.getElementById('main_view')
    update_cards(view)

})

// CLEAR COPY ARRAY
ipcRenderer.on('clear_copy_arr', (e) => {
    clear_copy_arr()
})

// REMOVE CARD
ipcRenderer.on('remove_card', (e, source) => {

    console.log('removing card')

    try {

        let card = document.querySelector('[data-href="' + source + '"]')
        let col = card.closest('.column')
        col.remove()

    } catch (err) {

    }


})

// CONFIRM OVERWRITE DIALOG
ipcRenderer.on('confirming_overwrite', (e, data, copy_files_arr) => {


    console.log('running confirming overwrite', copy_files_arr.length)
    let confirm_dialog = document.getElementById('confirm')

    let source_stats = fs.statSync(data.source)
    let destination_stats = fs.statSync(data.destination)


    // CHECKBOX REPLACE
    let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders');

    // CANCEL BUTTON
    let btn_cancel = add_button('btn_cancel', 'Cancel');
    btn_cancel.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('overwrite_canceled_all', copy_files_arr);
        } else {
            ipcRenderer.send('overwrite_canceled', copy_files_arr);
        }

    })


    // CONFIRM BUTTON
    let btn_replace = add_button('btn_replace', 'Replace');
    btn_replace.classList.add('primary');
    btn_replace.addEventListener('click', (e) => {

        if (is_checked) {
            ipcRenderer.send('overwrite_confirmed_all', copy_files_arr);
        } else {
            ipcRenderer.send('overwrite_confirmed', data, copy_files_arr);
        }

    })

    // SKIP BUTTON
    let btn_skip = add_button('btn_skip', 'Skip')
    btn_skip.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('overwrite_canceled_all')
            // alert('not yet implemented')
        } else {
            ipcRenderer.send('overwrite_skip', copy_files_arr)
        }

    })

    // FOOTER
    let footer = add_div()
    footer.style = 'position:fixed; bottom:0; height: 40px; margin-bottom: 25px;';
    footer.append(btn_cancel, btn_replace, btn_skip)


    let source_data = ''
    let destination_data = ''
    let header = ''

    // DIRECTORY
    if (destination_stats.isDirectory()) {

        btn_replace = add_button('btn_replace', 'Merge')
        btn_replace.classList.add('primary')

        let description = ''
        if (destination_stats.mtime > source_stats.mtime) {
            description = '<p>A newer folder with the same name already exists ' +
            'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        } else {
            description = '<p>A older folder with the same name already exists in ' +
            'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        }

        header = add_header('<br />Merge Folder:  ' + path.basename(data.source) + '<br /><br />')

        source_data = add_p(
            description +
            add_header('Original folder').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

        destination_data = add_p(
            add_header('Merge with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )

    // FILE
    } else {

        let description
        if (destination_stats.mtime >= source_stats.mtime) {
            description = '<p>A newer file with the same name already exists. ' +
            'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        } else {
            description = '<p>A older file with the same name already exists ' +
            'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        }

        header = add_header('<br />Replace File: <span>' + path.basename(data.source) + '</span><br />')

        // This is realy destination
        source_data = add_p(
            description +
            add_header('Original file').outerHTML +
            add_img(get_icon_path(data.destination)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )

        // This is realy source
        destination_data = add_p(

            add_header('Replace with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    }

    // HANDLE CHECKBOX
    let replace_all = add_div()
    let br = document.createElement('br')
    let br1 = document.createElement('br')
    replace_all.append(chk_replace_div)
    replace_all.append(br)
    replace_all.append(br1)

    confirm_dialog.append(header,source_data,destination_data,replace_all,footer);

    let chk_replace = document.getElementById('chk_replace')
    let is_checked = 0
    chk_replace.addEventListener('change', (e) => {
        if (chk_replace.checked) {
            is_checked = 1
        } else {
            is_checked = 0
        }
    })

})


// OVERITE COPY FILES
ipcRenderer.on('overwrite', (e, data) => {

    console.log('testing')

    let progress = document.getElementById('progress')


    let destination = data.destination
    let source = data.source

    console.log('destination ', destination, 'source', source)

    let destination_stats = fs.statSync(destination)
    let source_stats = fs.statSync(source)

    destination_size = destination_stats.size
    source_size = source_stats.size

    notification('overwriting file ' + destination)
    console.log('overwrite ', source, destination)

    if (destination_stats.isDirectory()) {

        copyFolderRecursiveSync(source, destination)

    } else {

        // COPY FILE
        fs.copyFile(source, destination, (err) => {

            let file_grid = document.getElementById('file_grid')

            if (err) {
                console.log(err)
            } else {

                // REMOVE PREVIOUS CARD
                let previous_card = document.querySelector('[data-href="' + destination + '"]')
                let col = previous_card.closest('.column')
                col.remove()

                // ADD CARD
                let options = {
                    id: 'file_grid_' + idx,
                    href: destination,
                    linktext: path.basename(destination),
                    grid: file_grid
                }

                try {

                    add_card(options).then(col => {

                        console.log(col)
                        file_grid.insertBefore(col, file_grid.firstChild)

                        // COUNT ITEMS IN MAIN VIEW
                        folder_count = get_folder_count()
                        file_count = get_file_count()

                        // RESET CARD INDE TO HANDLE LAZY LOADED IMAGES
                        cardindex = 0

                    })

                } catch (err) {
                    notification(err)
                }

            }

            // UPDATE CARDS
            update_cards(file_grid)

        })

    }

})

// OVERWRITE COPY ALL
ipcRenderer.on('overwrite_all', (e, copy_files_arr) => {

    console.log('size', copy_files_arr.length)

    copy_files_arr.forEach(item => {

        console.log('item',item)

        let source_stats = fs.statSync(item.source)
        console.log('data source', item.destination)

        // DIRETORY
        if (source_stats.isDirectory()) {

            copyFolderRecursiveSync(item.destination)

        // FILE
        } else {

            // console.log('source', data.source, 'dest', data.destination)
            copyFileSync(item.source, item.destination)

            // fs.copyFile(data.source, data.destination , (err) => {
            //     if (err) {
            //         console.log(err)
            //     } else {
            //         console.log('copy files',data.destination)
            //     }
            // })

        }

    })

    clear_copy_arr()
    // clear_selected_files()


})

// ON COPY COMPLETE
ipcRenderer.on('copy-complete', function (e) {
    get_files(breadcrumbs.value)
})

// CONFIRM MOVE
ipcRenderer.on('confirming_move', (e, data, copy_files_arr) => {

    console.log('array', copy_files_arr)

    let btn_cancel = add_button('btn_cancel', 'Cancel')
    let btn_ok = add_button('btn_ok', 'Move')
    btn_ok.classList.add('primary')

    let footer = add_div()
    footer.style = 'position:fixed; bottom:0; margin-bottom: 25px;';
    footer.append(btn_cancel)
    footer.append(btn_ok)

    let source_stats = fs.statSync(data.source)

    let header = add_header('<br />Confirm Move:  ' + path.basename(data.source) + '<br /><br />')

    let description = add_p('Move files ' + data.source)
    let source_data = add_p(
        add_header('').outerHTML +
        add_img(get_icon_path(data.source)).outerHTML +
        'Size:' + get_file_size(localStorage.getItem(data.source)) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
        '<br />' +
        '<br />'
    )

    let chk_div = add_div()
    let chk_move_all = add_checkbox('chk_replace', 'Apply this action to all files and folders')
    chk_div.append(chk_move_all)


    let confirm_dialog = document.getElementById('confirm')
    confirm_dialog.append(header,description,source_data,chk_div,add_br(),add_br(),add_br(),footer)


    chk = document.getElementById('chk_replace')

    // // MOVE ALL
    let is_checked = 0
    chk.addEventListener('change', (e) => {
        if (chk.checked) {
            is_checked = 1
        } else {
            is_checked = 0
        }
    })

    // MOVE CONFIRMED
    btn_ok.addEventListener('click', (e) => {

        if (is_checked) {
            ipcRenderer.send('move_confirmed_all', data, copy_files_arr)
        } else {
            console.log('moving', destination, copy_files_arr)
            ipcRenderer.send('move_confirmed', data, copy_files_arr)
        }

    })

    // CANCEL MOVE
    btn_cancel.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('move_canceled_all')
        } else {
            ipcRenderer.send('move_canceled')
        }

    })

    window.addEventListener('keyup', (e) => {

        if (e.key == 'Escape') {
            console.log('escape pressed on move')
            ipcRenderer.send('move_canceled')
        }

    })

    // confirm_dialog.append(header,description,source_data,chk_div,add_br(),add_br(),add_br(),btn_cancel,btn_ok)

})

// CONFIRM OVERWRITE MOVE DIALOG
ipcRenderer.on('confirming_overwrite_move', (e, data) => {
// function confirming_overwrite(data) {

    console.log('running confirming move overwrite')

    let confirm_dialog = document.getElementById('confirm')

    let source_stats = fs.statSync(data.source)
    let destination_stats = fs.statSync(data.destination)

    // let chk_replace_label = add_label('Apply this action to all files and folders')
    let chk_replace_div = add_checkbox('chk_replace', 'Apply this action to all files and folders')


    let footer = add_div();
    let btn_cancel = add_button('btn_cancel', 'Cancel');
    let btn_replace = add_button('btn_replace', 'Replace');
    let btn_skip = add_button('btn_skip', 'Skip');
    let icon = add_icon('info-circle');

    footer.style = 'position:fixed; bottom:0; margin-bottom: 25px;';
    footer.append(btn_cancel)
    footer.append(btn_replace)
    footer.append(btn_skip)
    // btn_replace.style = ';
    // btn_skip.style = 'position:absolute; bottom: 15; left: 150';
    // btn_cancel.style = 'position:absolute; bottom: 15, left: 300';

    //
    let confirm_msg = add_div();

    btn_replace.classList.add('primary');

    let source_data = '';
    let destination_data = '';
    let header = '';

    // DIRECTORY
    if (destination_stats.isDirectory()) {

        let description = ''
        if (destination_stats.mtime > source_stats.mtime) {
            description = '<p>A newer folder with the same name already exists. ' +
            'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        } else {
            description = '<p>An older folder with the same name already exists. ' +
            'Merging will ask for confirmation before replaceing any files in the folder that conflict with the files being copied</p>'
        }

        header = add_header('<br />Merge Folder:  ' + path.basename(data.source) + '<br /><br />')

        destination_data = add_p(
            description +
            add_header('Merge with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Original folder').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified: ' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime) +
            '<br />' +
            '<br />'
        )

    // FILE
    } else {

        let description = ''
        if (destination_stats.mtime >= source_stats.mtime) {
            description = '<p>A newer file with the same name already exists. ' +
            'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        } else {
            description = '<p>An older file with the same name already exists. ' +
            'Replacing will ask for confirmation before replaceing any files that conflict with the files being copied</p>'
        }

        header = add_header('<br />Replace File: <span>' + path.basename(data.source) + '</span><br /><br />')

        destination_data = add_p(
            description +
            add_header('Original file').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(destination_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(destination_stats.mtime) +
            '<br />' +
            '<br />'
        )
        source_data = add_p(
            add_header('Replace with').outerHTML +
            add_img(get_icon_path(data.source)).outerHTML +
            'Size:' + get_file_size(source_stats.size) + '<br />' + 'Last modified:' + new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(source_stats.mtime)
            // '<br />' +
            // '<br />'
        )

    }


    // HANDLE CHECKBOX
    let replace_all = add_div()
    let br = document.createElement('br')
    let br1 = document.createElement('br')
    replace_all.append(br)
    replace_all.append(br1)
    replace_all.append(chk_replace_div)

    confirm_dialog.append(header,destination_data,source_data,replace_all,footer)

    // Handle checkbox
    let chk_replace = document.getElementById('chk_replace')
    let is_checked = 0
    chk_replace.addEventListener('change', (e) => {
        if (chk_replace.checked) {
            is_checked = 1
        } else {
            is_checked = 0
        }
    })

    // MOVE OVERWRITE
    btn_replace.addEventListener('click', (e) => {

        if (is_checked) {
            ipcRenderer.send('overwrite_move_confirmed_all', data)
            // alert('not implemented yet');
        } else {
            ipcRenderer.send('overwrite_move_confirmed', data)
        }

    })

    // CANCEL OVERWRITE BUTTON
    btn_cancel.addEventListener('click', (e) => {
        ipcRenderer.send('overwrite_move_canceled')

    })

    // SKIP OVERWRITE BUTTON
    btn_skip.addEventListener('click', (e) => {
        if (is_checked) {
            ipcRenderer.send('overwrite_move_cancel_all')
        } else {
            ipcRenderer.send('overwrite_move_skip')
        }
    })


})


// OVERWRITE MOVE
ipcRenderer.on('overwrite_move', (e, data) => {

    console.log('testing')

    let progress = document.getElementById('progress')


    let destination = data.destination
    let source = data.source

    console.log('destination ', destination, 'source', source)

    let destination_stats = fs.statSync(destination)
    let source_stats = fs.statSync(source)

    destination_size = destination_stats.size
    source_size = source_stats.size

    notification('overwriting file ' + destination)
    console.log('overwrite ', source, destination)

    if (destination_stats.isDirectory()) {
        copyFolderRecursiveSync(source,destination)
    } else {

        // delete_file(destination).then(data => {

            // HANDLE PROGESS
            progress.classList.remove('hidden')
            progress.title = 'Moving ' + source
            progress.max = source_size

            let intervalid = setInterval(() => {

                progress.value = destination_size

                // console.log('source size', source_size,'destination size', destination_size)
                if (destination_size >= source_size) {
                    clearInterval(intervalid)
                    hide_top_progress()
                }

            }, 100)

            // COPY FILE
            fs.copyFile(source, destination, (err) => {

                console.log('copying file')

                let file_grid = document.getElementById('file_grid')

                if (err) {

                    console.log(err)

                } else {

                    delete_file(source)

                }

                // UPDATE CARDS
                update_cards(file_grid)

            })

        // })

    }

})

// ON MOVE CONFIRMED. todo: this needs work
ipcRenderer.on('move_confirmed', (e, data) => {

    let source = data.source
    let destination = data.destination

    console.log(destination,source)

    fs.copyFile(source,destination, (err) => {

        if (err) {
            console.log(err)

        } else {

            // REMOVE CARD
            let card = document.querySelector('[data-href="' + source + '"]')
            let col = card.closest('.column')
            col.remove()

            delete_file(source)

        }
    })

})

// OVERWRITE MOVE ALL
ipcRenderer.on('overwrite_move_all', (e, destination) => {

    copy_files_arr.forEach(data => {

        let source_stats = fs.statSync(data.source)
        console.log('data source', destination)

        // DIRETORY
        if (source_stats.isDirectory()) {



        // FILE
        } else {

            fs.copyFile(data.source, path.join(destination, path.basename(source)) , (err) => {
                if (err) {
                    console.log(err)
                } else {
                    // REMOVE CARD
                    // let card = document.querySelector('[data-href="' + data.source + '"]')
                    // let col = card.closest('.column')
                    // col.remove()
                    delete_file(data.source)
                }
            })

        }

    })

    clear_copy_arr()
    clear_selected_files()


})


// ON FILE SIZE
ipcRenderer.on('file_size', function (e, args) {

    let href = args.href
    let size = args.size

    try {
        let card = document.querySelector('[data-href="' + href + '"]')
        let extra = card.querySelector('.extra')

        extra.innerHTML = get_file_size(size)
        localStorage.setItem(href, args.size)

    } catch (err) {
        console.log(err)
    }

})

// ON DISk SPACE - NEW
ipcRenderer.on('disk_space', (e, data) => {

    console.log('disk space', data)

    if (data.length > 0) {



        let status = document.getElementById('status')
        status.innerHTML = ''
        let disksize = add_div()
        let usedspace = add_div()
        let availablespace = add_div()
        let foldersize = add_div()
        let foldercount = add_div()
        let filecount = add_div()

        data.forEach(item => {

            console.log('space', item)

            disksize.innerHTML = '<div class="item">Disk size: <b>&nbsp' + item.disksize + '</b></div>'
            usedspace.innerHTML = '<div class="item">Used space: <b>&nbsp' + item.usedspace + '</b></div>'
            availablespace.innerHTML = '<div class="item">Available space: <b>&nbsp' + item.availablespace + '</b></div>'
            foldersize.innerHTML = '<div class="item">Folder Size: <b>&nbsp' + item.foldersize + '</b></div>'
            foldercount.innerHTML = '<div class="item">Folder Count: <b>&nbsp' + item.foldercount + '</b></div>'
            filecount.innerHTML = '<div class="item">File Count: <b>&nbsp' + item.filecount + '</b></div>'

            // console.log('disk size ' + item.disksize)
            // console.log('used space ' + item.usedspace)
            // console.log('available space ' + item.availablespace)
            // console.log('folder size ' + item.foldersize)

            status.appendChild(disksize)
            status.appendChild(usedspace)
            status.appendChild(availablespace)
            status.appendChild(foldersize)
            status.appendChild(foldercount)
            status.appendChild(filecount)


        })

    } else {
        console.log('no data found')
    }

})

// ON FOLDER SIZE
ipcRenderer.on('folder_size', (e, data) => {

    // console.log('href ' + data.href)
    // console.log('setting local storage to ' + get_file_size(data.size))

    try {

        let card = document.querySelector('[data-href="' + data.href + '"]')
        let extra = card.querySelector('.extra')
        extra.innerHTML = get_file_size(data.size)

    } catch (err) {
        // console.log(err)
    }

    // SET SIZE TO HREF IN LOCAL STORAGE
    localStorage.setItem(data.href, data.size)

})

//ON GIO VOLUMES
ipcRenderer.on('gio_volumes', (e, res) => {

    console.log('results ', res)

})

// ON GIO DEVICE
ipcRenderer.on('gio_devices', (e, res) => {

    let data = res.split('\n')

    // console.log('running gio devices')

    // GET REFERENCE TO DEVICE GRID
    let device_grid = document.getElementById('device_grid')
    device_grid.innerHTML = ''

    let menu_items = add_div()
    menu_items.classList.add('ui', 'items')

    // CREATE VOLUMES ARRAY
    let volumes_arr = []

    data.forEach((item, idx) => {

        // CREATE VOLLUMES ARRAY
        if (item.indexOf('Volume(0):') > -1) {

            let split_item = item.split('->')
            // console.log(item)
            let volume_obj = {
                idx: idx,
                volume: split_item[0]
            }

            volumes_arr.push(volume_obj)

        }

    })


    // LOOP OVER VOLUMES ARRAY
    // volumes_arr.forEach((item, idx) => {

    // GIO OBJECT
    let gio = {}
    let subitem_counter = 0
    let is_activationroot = 0
    // LOOP OVER VOLUMES
    for (let i = 0; i < volumes_arr.length; i++) {

        let volume = volumes_arr[i].volume
        gio.volume = volume.replace('Volume(0):', '').trim()

        // LOOP OVER GIO DATA AND GET SUB ITEMS
        data.forEach((subitem, subidx) => {

            // console.log('running ' + volumes_arr[i + 1].idx)
            let volumeidx = volumes_arr[i].idx
            let volumeidx2 = data.length

            // IF MORE THAN 1 VOLUME IS FOUND GET ITS INDEX TO USE AS FILTER
            if (i < volumes_arr.length - 1) {
                volumeidx2 = volumes_arr[i + 1].idx
            }

            let uuid = ''

            // IF ARRAY COUNTER IS BETWEEN 1ST AND SECOND
            if (subidx >= volumeidx && subidx <= volumeidx2) {

                // console.log('sub item', subitem)

                if (subitem.indexOf('activation_root=') > -1) {

                    uuid = subitem.replace('activation_root=', '').trim()
                    gio.uuid = uuid
                    // CREATE HREF ELEMENT
                    let href = document.createElement('a')
                    let icon = document.createElement('i')
                    let icon_phone = document.createElement('i')
                    let menu_item = add_div()
                    let content = add_div()

                    href.href = '#'

                    href.classList.add('block')
                    icon.classList.add('icon', 'bi-hdd')
                    icon.style.marginLeft = '15px'
                    icon_phone.classList.add('icon', 'mobile', 'alternate')
                    menu_item.classList.add('item')
                    content.classList.add('item')

                    // ADD DATA
                    // let uuid_path = uuid
                    href.dataset.uuid = uuid
                    href.text = gio.volume
                    href.addEventListener('click', (e) => {
                        ipcRenderer.send('mount_gio', gio)
                    })

                    menu_item.appendChild(icon_phone)
                    content.appendChild(href)
                    menu_item.appendChild(content)
                    menu_items.appendChild(menu_item)
                    device_grid.appendChild(menu_items)

                    // if (subitem.indexOf('default_location=') > -1) {

                    //     uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
                    //     // gio.uuid = uuid
                    //     console.log('uuid')

                    // }

                    is_activationroot = 1
                    console.log('activation uuid', uuid)
                }

                if (subitem.indexOf('default_location=') > -1 && is_folder_card == 1) {

                    uuid = path.normalize(subitem.replace('default_location=file://', '').trim())

                    if (uuid.indexOf('sftp') === -1) {

                        // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
                        if (uuid.indexOf('default_location=') > -1 && subitem_counter == 0) {

                            // CREATE HREF ELEMENT
                            let href = document.createElement('a')
                            let icon = document.createElement('i')
                            let icon_phone = document.createElement('i')
                            let menu_item = add_div()
                            let content = add_div()

                            href.href = '#'

                            href.classList.add('block')
                            icon.classList.add('icon', 'bi-hdd')
                            icon.style.marginLeft = '15px'
                            icon_phone.classList.add('icon', 'mobile', 'alternate')
                            menu_item.classList.add('item')
                            content.classList.add('item')

                            // ADD DATA
                            uuid = uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                            href.dataset.uuid = uuid
                            href.text = gio.volume
                            href.addEventListener('click', (e) => {
                                get_files(uuid, () => {})
                            })

                            content.appendChild(href)
                            menu_item.appendChild(icon_phone)
                            menu_item.appendChild(content)
                            menu_items.appendChild(menu_item)

                            device_grid.appendChild(menu_items)

                            subitem_counter = 1

                        }

                        // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
                        if (uuid.indexOf('default_location=') === -1) {

                            // CREATE HREF ELEMENT
                            let href = document.createElement('a')
                            let icon = document.createElement('i')
                            let icon_phone = document.createElement('i')
                            let menu_item = add_div()
                            let content = add_div()

                            href.href = '#'

                            href.classList.add('block')
                            icon.classList.add('icon', 'bi-hdd')
                            icon.style.marginLeft = '15px'

                            icon_phone.classList.add('icon', 'mobile', 'alternate')
                            menu_item.classList.add('item')
                            content.classList.add('item')

                            // ADD DATA
                            uuid = uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                            href.dataset.uuid = uuid
                            href.text = gio.volume
                            href.addEventListener('click', (e) => {
                                get_files(uuid, () => {})

                            })

                            menu_item.appendChild(icon)
                            content.appendChild(href)
                            menu_item.appendChild(content)
                            menu_items.appendChild(menu_item)

                            device_grid.appendChild(menu_items)

                        }

                        // console.log('index ', subidx, 'uuid', uuid)
                        // console.log('default loc uuid', uuid)
                    }

                }

                // // IF ACTIVATION ROOT THEN ANDROID
                // if (subitem.indexOf('activation_root=') > -1) {

                //     // console.log(subitem + ' ' + subidx)
                //     uuid = subitem.replace('activation_root=', '').trim()
                //     gio.uuid = uuid

                //     // CREATE HREF ELEMENT
                //     let href = document.createElement('a')
                //     let icon = document.createElement('i')
                //     let icon_phone = document.createElement('i')
                //     let menu_item = add_div()
                //     let content = add_div()

                //     href.href = '#'

                //     href.classList.add('block')
                //     icon.classList.add('icon', 'hdd')
                //     icon_phone.classList.add('icon', 'mobile', 'alternate')
                //     menu_item.classList.add('item')
                //     content.classList.add('item')

                //     is_activationroot = 1

                //     // ADD DATA
                //     let uuid_path = gio.uuid
                //     href.dataset.uuid = uuid_path
                //     href.text = gio.volume
                //     href.addEventListener('click', (e) => {
                //         ipcRenderer.send('mount_gio', gio)
                //     })

                //     menu_item.appendChild(icon_phone)
                //     content.appendChild(href)
                //     menu_item.appendChild(content)
                //     menu_items.appendChild(menu_item)
                //     device_grid.appendChild(menu_items)

                //     if (subitem.indexOf('default_location=') > -1) {

                //         let uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
                //         gio.uuid = uuid
                //         console.log('uuid')

                //     }

                // }

                // if (subitem.indexOf('default_location=') > -1 && is_folder_card == 1) {

                //     // CREATE HREF ELEMENT
                //     let href = document.createElement('a')
                //     let icon = document.createElement('i')
                //     let icon_phone = document.createElement('i')
                //     let menu_item = add_div()
                //     let content = add_div()

                //     href.href = '#'

                //     href.classList.add('block')
                //     icon.classList.add('icon', 'hdd')
                //     icon_phone.classList.add('icon', 'mobile', 'alternate')
                //     menu_item.classList.add('item')
                //     content.classList.add('item')


                //     if (uuid.indexOf('sftp') === -1) {
                //         console.log('default loc uuid', uuid)

                //         uuid = path.normalize(subitem.replace('default_location=file://', '').trim())
                //         gio.uuid = uuid


                //         // IF UUID CONTAINS DEFAULT_LOCATION. ONLY SHOW FIRST INSTANCE
                //         if (gio.uuid.indexOf('default_location=') > -1 && subitem_counter == 0) {

                //             // ADD DATA
                //             let uuid_path = gio.uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                //             // let uuid_path = gio.uuid
                //             href.dataset.uuid = uuid_path
                //             href.text = gio.volume
                //             href.addEventListener('click', (e) => {
                //                 get_files(uuid_path)
                //             })

                //             menu_item.appendChild(icon_phone)
                //             content.appendChild(href)
                //             menu_item.appendChild(content)
                //             menu_items.appendChild(menu_item)

                //             subitem_counter = 1

                //         }

                //         // IF UUID DOES NOT CONTAIN DEFAULT_LOCATION
                //         if (gio.uuid.indexOf('default_location=') === -1) {

                //             // ADD DATA
                //             let uuid_path = gio.uuid.replace('default_location=', '/run/user/1000/gvfs/').replace('mtp:/', 'mtp:host=')
                //             href.dataset.uuid = gio.uuid
                //             href.text = gio.volume
                //             href.addEventListener('click', (e) => {
                //                 get_files(uuid_path)

                //             })

                //             menu_item.appendChild(icon)
                //             content.appendChild(href)
                //             menu_item.appendChild(content)
                //             menu_items.appendChild(menu_item)

                //         }

                //         console.log('index ', subidx, 'uuid', gio.uuid)
                //         device_grid.appendChild(menu_items)

                //     }


                // }

            }

        })

    }



})

// ON GIO MOUNTED
ipcRenderer.on('gio_mounted', (e, data) => {

    console.log('data ' + data)

    let path = ''
    if (data.indexOf('mounted at') > -1) {

        path = data.substring(
            data.indexOf("`") + 1,
            data.lastIndexOf("'")
        );

        if (path == '') { path = '/run/user/1000/gvfs' }
        get_files(path, () => {})

        console.log('path ' + path)

    } else {
        console.log('ohhhh nooooooo!')
    }

    if (data.indexOf('mounted at') > -1) {

    }

    if (data.indexOf('already mounted') > -1) {
        get_files('/run/user/1000/gvfs', () => {})
    }

    let str_arr = data.split(' ')
    console.log(str_arr)
    str_arr.forEach((item, idx) => {

        let direcotry = item.replace(".", "").replace("'", "").replace("`", "")

        if (item.indexOf('already mounted') != -1) {

            if (idx == 8) {

                // let direcotry = item.replace(".","").replace("'","").replace("`","")

                direcotry = item.replace(".", "").replace("'", "").replace("`", "")
                console.log(direcotry)
                get_files(direcotry.trim(), () => {})
            }


            // console.log(direcotry)
            // get_files(direcotry.trim(), {sort: localStorage.getItem('sort'), page: localStorage.getItem('page')})

            // get_files(path, {sort: localStorage.getItem('sort')})

        } else {
            // console.log()
        }
    })

})

// ON GIO MONITORED
ipcRenderer.on('gio_monitor', (e, data) => {

    console.log(data)

    let device_grid = document.getElementById('device_grid')
    device_grid.innerHTML = ''

    // ipcRenderer.send('get_gio_devices')

})

// ON GIO FILES
ipcRenderer.on('gio_files', (e, data) => {

    console.log(data.res)

    // SPLIT RETURED FILES / FOLDERS
    let files = data.res.split('\n')

    let folder_grid = document.getElementById('folder_grid')
    let file_grid = document.getElementById('file_grid')

    folder_grid.innerHTML = ''
    file_grid.innerHTML = ''
    folders_card.classList.remove('hidden')

    // LOOP OVER FILES / FOLDERS
    files.forEach((item, idx) => {


        let href = path.join('/run/user/1000/gvfs', data.data.replace('//', 'host='))

        // CREATE CARD OPTIONS
        let options = {

            id: 'card_id_' + idx,
            href: href,
            linktext: item,
            grid: folder_grid

        }

        console.log(options)

        try {

            add_card(options).then(card => {

                console.log(card)
                folder_grid.insertBefore(card, folder_grid.firstChild)



                // let header = document.getElementById('header_' + card_id)
                // header.classList.add('hidden')

                // let input = card.querySelector('input')
                // input.classList.remove('hidden')

                // //
                // input.focus()
                // input.select()

                // //
                update_cards()

            })

        } catch (err) {

            notification(err)
            info(err)

        }

    })

})

// ADD CARD VIA IPC
ipcRenderer.on('add_card', (e, options) => {

    try {

        let stats = fs.statSync(options.href)
        if (stats.isDirectory()) {
            options.grid = document.getElementById('folder_grid')
        } else {
            options.grid = document.getElementById('file_grid')
        }

        console.log('running add_card', options)

        add_card(options).then(card => {

            console.log(card)
            options.grid.insertBefore(card, options.grid.firstChild)

            // update_cards(document.getElementById('main_view'))
            // let item = card.querySelector('[data-href="' + options.href + '"]')
            // item.classList.add('highlight_select')

        })

        update_cards(document.getElementById('main_view'))
        // ui card fluid nav_item nav file_card
        // ui card fluid nav_item nav file_card ds-selectable

    } catch (err) {
        console.log(err)
    }

})

// ON DELETE CONFIRMED
ipcRenderer.on('delete_file_confirmed', (e, res) => {

    delete_confirmed()

})

// ON CREATE FILE FROM TEMPLATE
ipcRenderer.on('create_file_from_template', function (e, file) {
    // console.log('im running too many times')
    create_file_from_template(file.file)

})

// ON DEVICES
ipcRenderer.on('devices', (e, args) => {
    console.log('what the ' + args)
})

// // PROPERTIES WINDOW
ipcRenderer.on('file_properties_window', (e,data) => {
    get_file_properties(source)
})

// POPULATE FILE PROPERTIES
ipcRenderer.on('file_properties', (e, data) => {

    let file_properties = document.getElementById('file_properties')
    let header = add_header(data.name)
    let type = add_header(data.type)
    let content = add_header(data.contents)
    let size = add_header(data.size)
    let accessed = add_header(data.accessed)
    let modified = add_header(data.modified)
    let created = add_header(data.created)


    file_properties.append(
        add_br(),
        header,
        type,
        content,
        size,
        accessed,
        modified,
        created)

})

// todo: these need to be consolidated at ome point
// NOTICE
function notice(notice_msg) {
    // let container = document.getElementById('notice')
    // container.innerHTML = ''
    // container.innerHTML = notice_msg
}

// INFO
function info(msg) {
    let container = document.getElementById('info')
    container.style = 'font-size:small; right: 0;'
    container.classList.remove('hidden')
    container.innerHTML = ''
    container.innerHTML = msg
}

// NOTIFICATIONS
function notification(msg) {

    console.log(msg)

    notice(msg)
    info(msg)

    let status = document.getElementById('notification')
    let msg_div = add_div()

    // status.style = 'overflow:auto'
    msg_div.style = 'overflow:auto; margin-bottom: 10px;'

    msg_div.innerHTML = ''
    msg_div.innerHTML = msg


    // status.innerHTML = ''
    status.appendChild(msg_div)

    // let card = add_card(options)
    // column.appendChild(card)
    status.insertBefore(msg_div, status.firstChild)

}

///////////////////////////////////////////////////

// GET GIO DEVICES
// async function get_gio_devices() {
//     // ipcRenderer.send('get_gio_devices')
// }

// GET FILE CONTENTS. USED TO LOAD PAGES
async function get_file(file) {
    let res = fs.readFileSync(__dirname + '/' + file)
    return res
}

// CLEAR CACHE
function clear_cache() {

    let folder_cache = path.join(__dirname, '/', 'folder_cache.json')

}

// FILE PROPERTIES WINDOW
async function get_file_properties(filename) {

    let stats = fs.statSync(filename)

    console.log('source ' + stats)

    // properties_modal = document.getElementById('properties_modal')
    // properties_modal.classList.remove('hidden')
    // properties_modal.classList.add('active', 'visible')

    let properties_grid = document.getElementById('properties_grid')

    // BUILD PROPERTIES
    let name = path.basename(filename)
    let parent_folder = path.basename(filename)
    let type = stats.isDirectory()
    let modified = stats.mtime
    let crerated = stats.ctime

    properties_grid.innerHTML = name

}

// SET PROGRESS
ipcRenderer.on('progress', (e, max) => {
    get_progress(max)
})

// UPDATE PROGRESS
ipcRenderer.on('update_progress', (e, step) => {
    update_progress(step)
})


// UPDATE PROGRESS
function update_progress(val) {
    let progress = document.getElementById('progress');
    progress.value = val;
}

// SET PROGRESS
function get_progress(max) {

    let breadcrumbs = document.getElementById('breadcrumbs');
    let progress_div = document.getElementById('progress_div')
    let progress = document.getElementById('progress');

    progress_div.classList.remove('hidden')
    progress.classList.remove('hidden');

    progress.value = 0;

    // CONVERT TO KB
    max = max / 1024

    let cmd = "du -s '" + breadcrumbs.value + "' | awk '{print $1}'";

    exec(cmd, (err, stdout) => {

        var start_size = parseInt(stdout)

        progress.max = max + start_size;
        let current_size0 = 0;
        let current_size = 0;
        let interval_id = setInterval(() => {

            current_size0 = current_size

            cmd = "du -s '" + breadcrumbs.value + "' | awk '{print $1}'";
            exec(cmd, (err, stdout) => {
                if (err) {
                    console.log(err)
                } else {

                    current_size = parseInt(stdout);
                    console.log('max', max);
                    console.log('start size', start_size);
                    console.log('current size', current_size);

                    progress.value = current_size;

                    if (current_size0 >= current_size) {

                        progress.value = 0
                        progress_div.classList.add('hidden')
                        progress.classList.add('hidden')

                        clearInterval(interval_id);
                    }

                }
            })

        }, 500);

    })

}


// function set_progress(options) {

//     let size = 0

//     let progress = document.getElementById('progress')
//     progress.classList.remove('hidden')
//     progress.max = options.max
//     progress.value = 0


//     let interval_id = setInterval(() => {

//         let stats = fs.statSync(options.destination_file)

//         if (stats.isDirectory()) {

//             cmd = "du -s '" + options.destination_file + "' | awk '{print $1}'"

//             du = execSync(cmd)
//             size = parseInt(du) * 1024

//             // console.log(cmd)
//             // console.log('du size', size)
//             // console.log('max size', options.max)

//             // } else {

//             // size_file = stats.size

//         }

//         // progress.value = size
//         update_progress(size)

//         if (parseInt(size) >= (parseInt(options.max) - 10/100)) {
//             progress.classList.add('hidden')
//             clearInterval(interval_id)
//         }

//     }, 100);


// }




// function get_progress(source_size, destination_file, c) {

//     let progress = document.getElementById('progress')
//     progress.classList.remove('hidden')

//     // GET STATS
//     let stats = fs.statSync(destination_file)
//     console.log('dest size', stats.size, 'destination', destination_file)

//     // DIRECTORY
//     if (stats.isDirectory()) {

//         ipcRenderer.send('get_folder_size', { href: destination_file })
//         ipcRenderer.on('folder_size', (e, data) => {

//             current_size = data.size
//             transfer_speed = get_transfer_speed(source_size, current_size, c)

//             if (progress) {

//                 progress.value = current_size

//                 if (current_size >= source_size) {

//                     // HIDE PROGRESS BAR
//                     hide_progress()

//                     // CLEAR TIMER INTERVAL
//                     clearInterval(intervalid)
//                     console.log('clearing interval',interval_id)

//                 }



//             }

//         })

//     // FILE
//     } else {

//         current_size = stats.size
//         transfer_speed = get_transfer_speed(source_size, current_size, c)

//         if (progress) {

//             progress.value = current_size

//             if (parseInt(current_size) >= parseInt(source_size)) {

//                 // HIDE PROGRESS BAR
//                 hide_progress()

//                 // CLEAR TIMER INTERVAL
//                 clearInterval(interval_id)
//                 console.log('clearing interval',interval_id)

//             }

//         }

//     }

// }


// GET FILE TYPE
function get_mime_type(source) {

    let filepath = path.dirname(source)
    let filename = path.basename(source)

    // note: cmd needs to have this format. do not change "" for command and '' for path.
    let cmd = "xdg-mime query filetype '" + path.join(filepath, filename) + "'"

    console.log(cmd)
    let filetype = exec(cmd)

    filetype.on.stdout('data', data => {
        return data
    })

    // return filetype.toString().replace(/^\s+|\s+$/g, '')

}


// GET AVAILABLE LAUNCHERS
function get_available_launchers(filetype, source) {

    console.log(filetype)

    let launchers = []
    try {

        let cmd = "grep '" + filetype + "' /usr/share/applications/mimeinfo.cache"
        let desktop_launchers = execSync(cmd).toString().replace(filetype + '=', '').split(';')

        // const maptest = desktop_launchers.map(x => x.indexOf('Name=') > -1)
        // console.log('maptest ' + maptest)

        // maptest.forEach((item, idx) => {
        //     console.log('item ' + item)
        // })

        // console.log('filetype ' + desktop_launchers)
        // let searchStr = 'Exec='
        // let test = desktop_launchers.filter(x => x ==)

        if (desktop_launchers.length > 0) {

            for (let i = 0; i < desktop_launchers.length; i++) {

                let filepath = path.join('/usr/share/applications', desktop_launchers[i])

                if (!fs.statSync(filepath).isDirectory()) {

                    // GET DESKTOP LAUNCHER EXECUTE PATH
                    cmd = "grep '^Exec=' " + filepath
                    let exec_path = execSync(cmd).toString().split('\n')

                    // GET LAUNCHER NAME
                    cmd = "grep '^Name=' " + filepath
                    let exec_name = execSync(cmd).toString().split('\n')

                    // GET MIME TYPE
                    cmd = "xdg-mime query filetype '" + source + "'"
                    let exec_mime = execSync(cmd).toString()
                    // .split(';')

                    console.log('source = ' + source)
                    console.log('desktop launcher = ' + desktop_launchers[i])
                    console.log('exec path = ' + exec_path[0].replace('Exec=', ''))
                    console.log('name = ' + exec_name[0].replace("Name=", ""))
                    console.log('mimetype = ' + exec_mime)

                    // set_default_launcher(desktop_launchers[i],exec_mime[i].replace('MimeType=',''))

                    // let exe_path
                    // let launcher

                    // let desktop_file = fs.readFileSync(filepath,'utf8').split('\n')
                    // desktop_file.forEach((item, idx) => {
                    //     item = item.replace(',','')
                    //     if(item.indexOf('Name=') > -1 && item.indexOf('GenericName=') === -1) {
                    //         launcher = item.replace('Name=', '')
                    //     }
                    //     if(item.indexOf('Exec=') > -1 && item.indexOf('TryExec=') === -1) {
                    //         exe_path = item.replace('Exec=', '')
                    //     }
                    // })

                    let options = {
                        name: exec_name[0].replace('Name=', ''),
                        icon: '',
                        exec: exec_path[0].replace('Exec=', ''),
                        desktop: desktop_launchers[i],
                        mimetype: exec_mime
                    }

                    launchers.push(options)

                }
                // console.log('name ' + launcher + ' ' + exe_path)
            }

        }

    } catch (err) {

        console.log('what the ')

        let options = {
            name: 'Code', //exec_name[0].replace('Name=', ''),
            icon: '',
            exec: '/usr/bin/code "' + source + '"',
            desktop: '', //desktop_launchers[i],
            mimetype: 'application/text'
        }

        launchers.push(options)
        // console.log(err)
    }

    return launchers

}

// SET DEFAULT LAUNCHER
function set_default_launcher(desktop_file, mimetype) {

    // xdg-mime default vlc.desktop
    let cmd = 'xdg-mime default ' + desktop_file + ' ' + mimetype
    console.log(cmd)

    try {
        execSync(cmd)
    } catch (err) {
        notification(err)
    }

}


// GET NETWORK
async function get_network() {

    let network_grid = document.getElementById('network_grid');
    network_grid.innerHTML = '';

    let menu_items = add_div();
    menu_items.classList.add('ui', 'items');

    let dir = '/run/user/1000/gvfs/'

    fs.readdir(dir, function (err, files) {

        if (err) {
            console.log(err);
        } else {

            // console.log('network length ' + files.length)
            if (files.length > 0) {

                let content = add_div();
                content.classList.add('item');

                files.forEach((file, idx) => {

                    let filename = path.join('/run/user/1000/gvfs/', file);

                    // CREATE HREF ELEMENT
                    let href = document.createElement('a');
                    let icon = document.createElement('i')
                    let icon_phone = document.createElement('i');
                    let menu_item = add_div();

                    // let hr = add_div()

                    href.href = filename
                    href.text = file
                    href.dataset.uuid = filename
                    href.title = filename
                    // href.preventDefault = true

                    // hr.classList.add('ui','horizontal','divider')
                    href.classList.add('block', 'header_link')
                    icon.classList.add('icon', 'hdd')
                    icon.style.marginLeft = '15px'
                    icon_phone.classList.add('icon', 'mobile', 'alternate')
                    menu_item.classList.add('item')


                    menu_item.appendChild(icon)
                    content.appendChild(href)
                    menu_item.appendChild(content)
                    menu_items.appendChild(menu_item)

                    // network_grid.appendChild(hr)
                    network_grid.appendChild(menu_items)

                    href.addEventListener('click', (e) => {
                        get_files(filename, () => {})
                    })


                })

                network_grid.closest('.content').classList.add('active')

            }

        }

        update_cards(network_grid)

    })

}


// GET TRANSFER SPEED
function get_transfer_speed(source_size, destination_size, elapsed_time) {

    let transfer_speed = parseInt(destination_size) / parseInt(elapsed_time)
    let transfer_time = parseInt(source_size) / parseInt(transfer_speed)
    let transfer_data_amount = parseInt(transfer_speed) * parseInt(transfer_time)

    console.log('destination size ' + get_file_size(destination_size))
    console.log('source size ' + get_file_size(source_size))

    console.log('elapsed speed ' + elapsed_time)

    console.log('transfer speed ' + get_file_size(transfer_speed))
    console.log('transfer time ' + transfer_time)
    console.log('transfer amount ' + get_file_size(transfer_data_amount))

    let options = {
        transfer_speed: transfer_speed,
        transfer_time: transfer_time,
        transfer_data_amount: transfer_data_amount
    }

    return options

}

// ON ICON PATH
ipcRenderer.on('icon_path', (e, data) => {

    console.log('running on icon_path')

    let href = data.href
    let card = document.querySelector('[data-href="' + href + '"]')
    let img = card.querySelector('img')
    img.src = data.icon_path

})

var cardindex = 0

// ADD CARD //////////////////////////////////////////////////////////////////////
async function add_card(options) {

    try {

            //
            let id = options.id
            let href = options.href
            let linktext = options.linktext
            let icon_path = get_icon_path(href) //options.image
            let is_folder = options.is_folder

            // CHECK IF GVFS
            // let is_gvfs = 0
            // let gvfs = href.indexOf('/gvfs') // -1 is false
            // if (gvfs > -1) {
            //     is_gvfs = 1
            // }

            let size = '' //options.size
            let grid = options.grid

            // CREATE ELEMENTS
            let col = add_div()
            let card = add_div()
            let items = add_div()
            let item = add_div()
            let image = add_div()
            let img = document.createElement('img')
            let content = add_div()
            let extra = add_div()
            let progress = add_div()
            let progress_bar = add_progress()
            let header = document.createElement('a')
            let input = document.createElement('input')
            let form_field = add_div()
            let popovermenu = add_div()

            let form_control = add_div()
            let form = document.createElement('form')


            // ADD CSS
            input.setAttribute('required', 'required')
            col.classList.add('column', 'three', 'wide')

            popovermenu.classList.add('popup')

            card.classList.add('ui', 'card', 'fluid', 'nav_item', 'nav')
            card.draggable = 'true'


            card.id = id
            card.dataset.href = href
            input.spellcheck = false

            // SET INDEX FOR NAVIGATION
            if (grid.id == 'folder_grid' || grid.id == 'file_grid') {
                cardindex += 1
                card.dataset.id = cardindex
            }

            // CHECK IF IMAGE
            if (

                path.extname(href) === '.png' ||
                path.extname(href) === '.jpg' ||
                path.extname(href) === '.svg' ||
                path.extname(href) === '.gif' ||
                path.extname(href) === '.webp' ||
                path.extname(href) === '.jpeg'

            ) {
                img.classList.add('img')
                img.style = 'border: 2px solid #cfcfcf; background-color: #cfcfcf'
            }

            // CREATE ITEMS
            items.classList.add('ui', 'items')

            // CREATE ITEM
            item.classList.add('item', 'fluid')

            // CREATE IMAGE CLASS
            image.classList.add('image')
            // image.style = 'width:36px; height:36px;cursor:pointer'

            // DISABLE IMAGE DRAG
            img.draggable = false

            // SET FOLDER ICON
            if (grid.id == 'folder_grid') {

                get_folder_icon(icon => {
                    img.src = icon
                })


            // SEARCH AND WORKSPACE ICONS
            } else if (grid.id == 'search_results' || grid.id == 'workspace_grid') {

                card.style.marginLeft = '15px'
                img.classList.add('workspace_icon')
                ipcRenderer.send('get_icon_path', href)

            // FILE ICONS
            } else {

                // if (cardindex > 1 && id != 0) {

                    // console.log('getting file icons')

                    // img.src = path.join(icon_dir, '/actions/scalable/image-x-generic-symbolic.svg')
                    // img.dataset.src = icon_path
                    // img.classList.add('lazy')

                    if (img.classList.contains('img')) {

                        img.src = path.join(icon_dir, '/actions/scalable/image-x-generic-symbolic.svg')
                        img.dataset.src = icon_path
                        img.classList.add('lazy')

                    } else {
                        ipcRenderer.send('get_icon_path', href)
                    }


                // } else {

                    // if (!img.classList.contains('img')) {
                    //     ipcRenderer.send('get_icon_path', href)
                    // }

                // }

            }

            /////////////////////////////////////////////////////////////

            let cardclick_st = new Date().getTime()

            // CARD CLICK
            card.addEventListener('click', function (e) {

                e.preventDefault()
                e.stopPropagation()

                // ADD ITEM TO CLIPBOARD FOR IMAGES THIS WILL NEED TO CHANGE
                // let clipboard_image = nativeImage.createFromPath(href)
                // clipboard.writeImage(clipboard_image, "clipboard")


                // CRTRL+SHIFT ADD TO WORKSPACE
                if (e.ctrlKey == true && e.shiftKey == true) {

                    notification('ctrl + shift clicked')
                    add_workspace()

                    // MULTI SELECT
                } else if (e.ctrlKey == true) {

                    notification('ctlr pressed')

                    // CHECK IF ALREADY SELECTED
                    if (this.classList.contains('highlight_select') || this.classList.contains('ds-selected')) {

                        // REMOVE HIGHLIGHT
                        this.classList.remove('highlight_select', 'ds-selected')

                    } else {

                        // ADD HIGHLIGHT
                        this.classList.add('highlight_select')

                    }


                // SINGLE SELECT
                } else {

                    clear_selected_files()

                    // HIGHLIGHT
                    if (this.classList.contains('highlight_select')) {

                        // remove_selected_file(href)
                        this.classList.remove('highlight_select')

                        //
                    } else {

                        // NAV COUNTER
                        nc = parseInt(card.dataset.id)
                        console.log('counter ' + nc)

                        this.classList.add('highlight_select')

                        if (prev_card) {

                            prev_card.classList.remove('highlight_select')
                            prev_card = this

                        } else {

                            prev_card = this
                        }

                    }

                }

            })

            let cardclick_et = new Date().getTime() - cardclick_st

            // LISTEN FOR CONTEXT MENU. LISTEN ONLY DONT SHOW A MENU HERE !!!!!!
            card.addEventListener('contextmenu', function (e) {

                // SET GLOBAL CARD_ID
                console.log('setting global card_id to ' + card.id)
                card_id = card.id

                // todo: this needs work add selected files here has unintended results
                // !! DO NOT USE ADD_SELECTED_FILES HERE. YOU MIGHT DELETE SOMETHING IMPORTANT!!!
                source = href

                if (is_folder) {

                    // SHOW FOLDER MENU
                    card.classList.add('folder_card', 'highlight_select')

                } else {

                    // SHOW FILE MENU
                    card.classList.add('file_card', 'highlight_select')

                }

            })

            // MOUSE OVER
            let timeoutid
            card.addEventListener('mouseover', function (e) {

                e.preventDefault()

                // SET GLOBAL CARD ID ON HOVER
                // todo: this needs to be vetted
                card_id = id

                // HIGHLIGHT CARD timeoutid = setTimeout(() => {
                card.classList.add("highlight")

                nc = nc2
                nc2 = parseInt(card.dataset.id)

                active_href = href;

            })

            //  OUT
            card.addEventListener('mouseout', function (e) {

                let cards = document.getElementsByClassName('card')
                for (let i = 0; i < cards.length; i++) {
                    cards[i].classList.remove('highlight')
                }

            })

            // IMG CLICK
            img.addEventListener('click', function (e) {
                e.preventDefault()

                if (is_folder) {
                    get_files(href, () => {})
                } else {
                    open(href, {wait: false})
                }

            })

            // CREATE CONTENT
            content.classList.add('content')
            content.style = 'overflow-wrap: break-word;'

            // CREATE HEADER
            header.href = href
            header.text = linktext
            header.title = 'open file? ' + href
            header.id = 'header_' + id
            header.classList.add('header_link')
            header.draggable = false


            header.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()

                if (is_folder) {
                    get_files(href, () => {
                        console.log('shit')
                    })
                } else {
                    open(href, {wait: false})
                }

            })


            // HEADER MOUSE OVER
            header.addEventListener('mouseover', function (e) {
                if (is_folder) {
                    card_id = id
                }
            })

            // HEADER MOUSE OUT
            // header.addEventListener('mouseout', function (e) {
            //     // img.src = icon_path
            // })

            form_field.classList.add('one', 'fields')

            // FOR EDIT MODE
            input.id = 'edit_' + id
            input.classList.add('hidden', 'input')
            input.type = 'text'
            input.spellcheck = false
            input.value = linktext


            // selrange.moveEnd(href.length - path.extname(href).length)


            // CHANGE EVENT
            input.addEventListener('change', function (e) {

                e.preventDefault()

                console.log(this.required)

                // todo: this needs a lot of input checking

                if (this.value == "") {

                    alert('enter a name')

                } else {

                    card.classList.add('highlight_select')

                    // RENAME FILE
                    rename_file(href, this.value.trim())

                    this.classList.add('hidden')

                    href = path.dirname(href) + '/' + this.value
                    card.dataset.href = href

                    header.classList.remove('hidden')
                    header.text = this.value
                    header.href = href
                    header.title = 'open file? ' + path.dirname(href) + '/' + this.value

                    source = path.dirname(href) + '/' + this.value.trim()

                    // // header.focus()

                    // let main_view = document.getElementById('main_view')
                    update_card(source)
                    // clear_selected_files()

                }

            })

            // KEYDOWN EVENT
            input.addEventListener('keydown', function (e) {

                if (e.key === 'Escape' || e.key === 'Tab') {

                    // CLEAR ITEMS
                    console.log('esc pressed on keydown')
                    clear_selected_files()

                    // CLEAR COPY ARRAY
                    copy_files_arr = []

                }

            })

            // INPUT CLICK
            input.addEventListener('click', function (e) {
                e.stopPropagation()
                e.preventDefault()
            })


            form_control = add_div()

            form_field.appendChild(input)
            form_control.appendChild(form_field)
            form.appendChild(form_control)

            form.preventDefault = true

            let description = add_div()
            description.classList.add('description', 'no-wrap')
            // description.innerHTML = mtime
            description.draggable = false


            extra.classList.add('extra')
            extra.innerHTML = size
            extra.draggable = false

            progress.id = 'progress_' + id
            progress.classList.add('hidden', 'progress')

            progress_bar.id = 'progress_bar_' + id
            progress_bar.value = '1'
            progress_bar.max = '100'

            // ON DRAG START
            card.ondragstart = function (e) {

                // e.preventDefault()

                console.log('on drag start')
                clear_copy_arr()

                // let datalist = e.dataTransfer.items
                // let data = fs.readFileSync(href)
                // let blob = new Blob([data])
                // let file = new File([blob], path.basename(href), {type: 'text/plain', webkitRelativePath: href})
                // const fr = new FileReader()
                // fr.readAsText(file)
                // e.dataTransfer.setData(path.basename(href), "testing")
                // console.log('bufer data', file)
                // datalist.add(file)

                e.dataTransfer.effectAllowed = 'copyMove'

                let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
                console.log('items', items.length)

                if (items.length > 0) {

                    items.forEach((item,idx) => {
                        let href = item.dataset.href
                        let id = item.dataset.id
                        add_copy_file(href, id)
                        console.log('size', items,length, 'href', href)
                    })

                }

            }

            // INITIALIZE COUNTER
            let dragcounter = 0

            // ON DRAG ENTER
            card.ondragenter = function (e) {

                e.preventDefault()
                e.stopPropagation()

                dragcounter++

                let target = e.target
                notification('running card on dragenter ' + target.id)

                // CARD. NOTE. THIS SEEMS BACKWARDS BUT WORKS AND IS ESSENTIAL FOR SETTING THE CORRECT TARGET PATH. NOT SURE WHY ??
                if (target.id == "") {
                    destination = href
                    // card.classList.add('highlight_select')
                    // BLANK
                } else {

                    destination = breadcrumbs.value
                }

                let main_view = document.getElementById('main_view')
                main_view.classList.add('selectableunselected')
                main_view.draggable = false

                if (e.ctrlKey == true) {
                    e.dataTransfer.dropEffect = "copy";
                    console.log('ctrl pressed')
                } else {
                    e.dataTransfer.dropEffect = "move";
                }

                return false

            }

            // DRAG OVER
            card.ondragover = function (e) {

                // ADD HIGHLIGHT
                // card.classList.add('highlight_select')
                card.classList.add('highlight')

                if (e.ctrlKey == true) {
                    e.dataTransfer.dropEffect = "copy";
                    console.log('ctrl pressed')
                } else {
                    e.dataTransfer.dropEffect = "move";
                }

                e.preventDefault()
                e.stopPropagation()

                return false

            }

            // ON DRAG LEAVE
            card.ondragleave = function (e) {

                dragcounter--

                // card.classList.remove('highlight_select')
                card.classList.remove('highlight')

                if (dragcounter === 0) {


                    // TURN DRAGGABLE ON MAIN CARD ON
                    notification('setting draggable to true on main view')

                    // card.classList.remove('highlight_select')

                    let main_view = document.getElementById('main_view')

                    // main_view.draggable = true

                    notification('running on drag leave card')

                }

                e.preventDefault()
                e.stopPropagation()

                return false
            }

            // console.log(card)

            card.appendChild(items)
            items.appendChild(item)
            item.appendChild(image)
            image.appendChild(img)
            item.appendChild(content)
            item.appendChild(popovermenu)
            content.appendChild(header)
            content.appendChild(form_control)
            content.appendChild(description)

            progress.appendChild(progress_bar)

            content.appendChild(extra)
            content.appendChild(progress)

            col.appendChild(card)
            grid.appendChild(col)


            return await col



    } catch (err) {
        console.log(err)
        return err
    }


}


// SHOW LOADER
function show_loader() {

    let loader = document.getElementById("loader")
    loader.classList.add('active')
    loader.style = 'background: transparent !important'

    setTimeout(() => {

        // console.log(loader.classList.contains('active'))
        // alert('Oh no. Operation timed out!')

        if (loader.classList.contains('active')) {

            loader.classList.remove('active')
            alert('Oh no. Operation timed out!')
        }

    }, 20000);
}

// HIDE LOADER
function hide_loader() {
    let loader = document.getElementById("loader")
    loader.classList.remove('active')
}

// ADD BREADCUMBS
function add_pager_item(options) {

    let pager = document.getElementById('pager')


    let breadcrumbs = add_div()
    breadcrumbs.classList.add('ui', 'breadcrumb')

    let section = add_link()
    section.classList.add('section', 'active', 'item')
    section.text = options.name
    section.href = '#'

    let divider = add_div()
    divider.classList.add('divider')
    divider.innerText = '/'

    breadcrumbs.appendChild(section)
    breadcrumbs.appendChild(divider)
    pager.appendChild(breadcrumbs)

    section.addEventListener('click', function (e) {
        pager.html = ''
        get_files(options.dir, { sort: localStorage.getItem('sort'), page: options.name })
    })

}


// ADD LIST ITEM
function add_list_item(options) {

    let list_item = add_div()
    let list_item1 = add_div()
    let folder_icon = document.createElement('i')
    let content = add_div()
    let header = add_div() // document.createElement('a')
    let description = add_div()
    // let list1 = add_div()

    // list.classList.add('ui','list')
    list_item.classList.add('item')
    list_item1.classList.add('item')
    folder_icon.classList.add('folder', 'icon', 'large')
    content.classList.add('content')
    header.classList.add('header')
    description.classList.add('description')


    header.innerHTML = options.header
    // description.innerHTML = 'what'

    // list.appendChild(item)
    list_item.appendChild(folder_icon)
    list_item.appendChild(content)

    content.appendChild(header)
    content.appendChild(description)
    content.appendChild(list_item1)

    return list_item

}

// RUN COMMAND
var execute = function (command, callback) {
    exec(command, { maxBuffer: 1024 * 500 }, function (error, stdout, stderr) { callback(error, stdout); });
};


// GET DISK USAGE
let du = []
async function get_disk_usage() {

    let cmd = 'df -Ph'

    // cmd = 'cd "' + filename + '"; du -s'
    let child = exec(cmd)

    //
    child.stdout.on("data", (du_data) => {

        let du_grid = document.getElementById('du_grid')
        du_grid.innerHTML = ''
        // let du = du_data.split('\t')
        let du = du_data.split('\n')

        for (let i = 0; i < du.length; i++) {

            console.log(du[i])

            let du_col = add_div()


            du_col.innerHTML = du[i] + '</br></br>'
            du_grid.appendChild(du_col)

        }

        // console.log(du_data)

        //     options.size = get_file_size(size)

        //     let card = add_card(options,i)
        //         let files_col = add_div()
        //         files_col.classList.add('column', 'three', 'wide')
        //         files_col.appendChild(card)
        //         folder_grid.appendChild(files_col)

    })


}

// PAGER
function paginate(array, page_size, page_number) {
    // human-readable page numbers usually start with 1, so we reduce 1 in the first argument
    return array.slice((page_number - 1) * page_size, page_number * page_size);
}

// ADD TREE ITEM
function add_tree_item(options) {

    let filename = options.linktext
    let filepath = options.href

    let items = add_div()
    let item = add_div()
    let header = add_div()
    let icon_div = add_div()
    let icon = document.createElement('i')
    let subicon_div = add_div()
    let subicon = document.createElement('i')
    let href = document.createElement('a')
    let content = add_div()
    let subitems = add_div()

    icon.classList.add('right', 'icon', 'hdd')
    items.classList.add('ui', 'items')
    item.classList.add('item', 'no-wrap')
    item.style = 'margin-bottom:0px; padding-bottom:2px'
    header.classList.add('header')
    header.style = 'font-size: 12px;'
    content.classList.add('content', 'tree_item')
    subitems.style = 'margin-left: 10px;'
    item.draggable = false


    // CHECK FOR SUB DIRS
    let subdirs = ''
    try {
        subdirs = fs.readdirSync(filepath, { withFileTypes: true })
    } catch (err) {

    }

    if (subdirs.length > 0) {
    }

    href.src = filepath
    href.text = filename + ' (' + subdirs.length + ')'
    href.style = 'color:#cfcfcf !important;'
    header.appendChild(href)

    subitems.dataset.id = filename

    if (subdirs.length > 0) {

        for (let i = 0; i < subdirs.length; i++) {

            let subfilename = subdirs[i].name
            let subfilepath = path.join(filepath, '/', subfilename)

            let stats
            try {
                stats = fs.statSync(subfilepath)
            } catch (err) {

            }


            if (stats) {

                if (stats.isDirectory() == true) {

                } else {

                }

            }

            subicon.classList.add('icon', 'bi-folder', 'tree_subicon')
            subicon_div.append(subicon)

        }

    }

    else {

        // icon.classList.add('icon')
        // subicon_div.classList.add('tree_subicon')
        subicon.classList.add('icon', 'bi-folder', 'tree_subicon')
        subicon_div.append(subicon)

    }


    if (path.dirname(filepath) == '/media/michael') {
        console.log('here we are')
        subicon.classList.add('icon', 'hdd', 'outline')
    }

    // content.appendChild(icon)
    // content.appendChild(subicon)
    content.appendChild(subicon_div)
    content.appendChild(header)
    // content.appendChild(icon_div)

    items.appendChild(item)
    items.appendChild(subitems)
    item.appendChild(content)


    // ITEM CLICK
    item.addEventListener('click', function (e) {

        e.preventDefault()
        e.stopPropagation()

        if (icon.classList.contains('right')) {

            icon.classList.remove('right')
            icon.classList.add('down')

            try {
                get_tree(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            icon.classList.add('right')
            icon.classList.remove('down')

            subitems.classList.add('hidden')

        }

        // get_files(filepath,{sort: localStorage.getItem('sort')})

    })

    // TREE ICON CLICK
    icon.addEventListener('click', function (e) {
        e.preventDefault()

        if (icon.classList.contains('right')) {

            icon.classList.remove('right')
            icon.classList.add('down')

            try {
                get_tree(filepath)
            } catch (err) {

            }
            subitems.classList.remove('hidden')

        } else {

            icon.classList.add('right')
            icon.classList.remove('down')

            subitems.classList.add('hidden')

        }

    })


    // HEADER CLICK
    header.addEventListener('click', function (e) {

        e.preventDefault()
        e.stopPropagation()


        // // CHECK IF THERE ARE SUBDIRECTORIES
        // if (icon.classList.contains('right')) {

        //     icon.classList.remove('right')
        //     icon.classList.add('down')

        //     try {
        //         get_tree(filepath)
        //     } catch (err) {

        //     }

        //     subitems.classList.remove('hidden')

        // } else {

        //     icon.classList.add('right')
        //     icon.classList.remove('down')

        //     subitems.classList.add('hidden')

        // }

        get_files(filepath, () => {})

    })

    item.addEventListener('mouseover', function (e) {
        this.classList.add('highlight')
    })


    item.addEventListener('mouseout', function (e) {
        this.classList.remove('highlight')
    })

    return items

}

// TREE
async function get_tree(dir) {

    console.log('running get tree ' + dir)

    let dirents = fs.readdirSync(dir, { withFileTypes: true })

    if (dirents) {

        let tree_grid
        if (dir == '/') {
            tree_grid = document.querySelector('[data-id="/"]')
        } else if (dir == '/media/michael') {
            tree_grid = document.querySelector('[data-id="/media/michael"]')
        } else {
            tree_grid = document.querySelector('[data-id="' + basename(dir) + '"]')
        }


        tree_grid.innerHTML = ''


        //SET DEFAULT SORT OPTION
        if (!options.sort) {
            options.sort = 1
        }

        // SORT BY NAME
        filter = dirents.sort((a, b) => {
            if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) {
                return -1;
            }
            if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) {
                return 1;
            }
            return 0;
        })


        const regex = /^\..*/
        filter.forEach((file, idx) => {

            if (regex.test(file.name) == false || localStorage.getItem('show_hidden') == 1) {

                let filename = file.name
                let filepath = dir + '/' + filename
                let stats = fs.statSync(filepath)
                let is_dir = stats.isDirectory()

                if (is_dir) {

                    let options = {
                        id: 'tree_' + idx,
                        href: filepath,
                        linktext: filename,
                        image: '../assets/icons/vscode/default_folder.svg',  //get_icon_path(filepath),
                        is_folder: true,
                        description: '',
                        size: 0
                    }

                    // console.log(options)
                    // let card = add_card(options)
                    let card = add_tree_item(options)


                    // console.log(card)a
                    tree_grid.appendChild(card)
                    card.style = 'border: none; margin:0px'


                }

            }

        })

    }

}

// // GET_TEMPLATES
// let templates_arr = []
// function get_templates(){

//     let templates = fs.readdirSync('assets/templates')
//     for(let i = 0; i < templates.length; i++){
//         console.log(templates[i])
//     }

// }


// GET FILE FROM TEMPLATE
function get_templates(file) {

    let templates = fs.readdirSync('assets/templates')
    for (let i = 0; i < templates.length; i++) {
        console.log(templates[i])
    }

}

// DISK USAGE CHART
var disk_usage_chart
function bar_chart(chart_labels, chart_labels1, chart_data) {

    console.log(chart_labels)
    console.log(chart_data)

    if (disk_usage_chart != undefined) {
        disk_usage_chart.destroy()
    }

    const ctx = document.getElementById('myChart').getContext('2d');


    disk_usage_chart = new Chart(ctx, {

        type: 'bar',
        data: {
            labels: chart_labels,
            datasets: [{
                label: '',
                data: chart_data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    ticks: {
                        callback: function (value) {
                            return get_file_size(value)
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                },
                // yLabels: {
                //     callback: function (args1, args2) {
                //         return 'shit'
                //     }
                // }
            },
            plugins: {
                legend: {
                    display: false,
                },
                footer: {
                    display: false,
                }
            }
        }

    })



}

// CHART OPTIONS
function get_disk_usage_chart() {

    // notification('getting disk usage chart')


    let cmd = "df '" + breadcrumbs.value + "'"
    let child = exec(cmd)

    let chart_labels = []
    let chart_labels1 = []
    let chart_data = []


    child.stdout.on("data", (res) => {

        let res1 = res.split('\n')

        let headers = res1[0].split(' ')
        let details = res1[1].split(' ')
        for (let i = 0; i < headers.length; i++) {

            if (headers[i] != '') {
                chart_labels.push(headers[i])
            }

            // if(details[i] != ''){
            //     chart_data.push(details[i])
            // }
        }


        for (let i = 0; i < details.length; i++) {

            if (details[i] != '') {
                chart_labels1.push(get_file_size(details[i]))
            }

        }


        for (let i = 0; i < details.length; i++) {

            if (details[i] != '') {
                chart_data.push(details[i])

            }

        }

        cmd = 'cd "' + breadcrumbs.value + '"; du -s'
        du = exec(cmd)

        du.stdout.on('data', function (res) {

            // let item = add_div()
            // let extra = folder_card[i].querySelector('.extra')

            let size = parseInt(res.replace('.', ''))
            // size = get_file_size(size)

            chart_labels.push('folder size')
            chart_data.push((size))

            // if (size > 1000000000) {
            //     extra.innerHTML = '<span style="color:red">' + get_file_size(size) + '</span>'
            // } else {
            // }

            // notification(chart_data)
            bar_chart(chart_labels, chart_labels1, chart_data)


        })


    })

}

// GET DISK SPACE
function get_diskspace(dir) {

    let cmd = 'df "' + dir + '"'
    let child = exec(cmd)

    // let chart_labels = []
    // let chart_data = []

    child.stdout.on("data", (res) => {

        let status = document.getElementById('status')
        status.innerHTML = ''

        res = res.split('\n')

        for (let i = 1; i < res.length - 1; i++) {


            // notification(res[i])

            res1 = res[i].split(' ')

            if (res1.length > 0) {

                // status.innerHTML = 'size:' + res1[]

                for (let i = 0; i < res1.length; i++) {

                    // 0 DISK
                    // 6 SIZE OF DISK
                    // 7 USED SPACE
                    // 8 AVAILABLE SPACE
                    // 10 PERCENTAGE USED
                    // 11 CURRENT DIR

                    if (res1[i] != '') {

                        let item = add_div()
                        item.style = 'padding-right: 5px'

                        chart_labels.push('')
                        chart_data.push(res1[i])

                        switch (i) {
                            case 6:
                                item.innerHTML = '<div class="item">Disk size: <b>&nbsp' + get_file_size(res1[i] * 1024) + '</b></div>'
                                break;
                            case 7:
                                item.innerHTML = '<div class="item">Used space: <b>&nbsp' + get_file_size(res1[i] * 1024) + '</b></div>'
                                break;
                            case 8:
                                item.innerHTML = '<div class="item">Available space: <b>&nbsp' + get_file_size(res1[i] * 1024) + '</b></div>'
                                break;
                        }

                        status.appendChild(item)

                    }

                }
                notification(chart_labels + ' ' + chart_data)
                get_disk_usage_chart(chart_labels, chart_data)
            }
        }


        cmd = 'cd "' + breadcrumbs.value + '"; du -s'
        du = exec(cmd)

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', '') * 1024)
            size = get_file_size(size)

            let item1 = add_div()
            item1.innerHTML = '<div class="item">Folder Size: <b>&nbsp' + size + '</b></div>'
            status.appendChild(item1)


            let item2 = add_div()
            item2.innerHTML = '<div class="item"><b>' + directories.length + '</b>&nbsp Folders / <b>' + files.length + '</b>&nbsp Files</div>'
            status.appendChild(item2)


        })

    })

}

// GET DIR SIZE
async function get_dir_size(dir) {

    // need to replace href here

    href = dir


    cmd = "cd '" + href + "'; du -s"

    console.log(cmd)

    du = exec(cmd)

    return new Promise((resolve, reject) => [

        du.stdout.on('data', function (res) {

            let size = parseInt(res.replace('.', '') * 1024)
            resolve(size)

        })

    ])

}

// GET FOLDER SIZE
function get_folder_size(href) {

    return new Promise(resolve => {

    console.log('running get folder size')

    let breadcrumbs = document.getElementById('breadcrumbs')
    if (breadcrumbs.value.indexOf('gvfs') == -1) {

        // cmd = 'cd "' + dir + '"; du -b'
        // return du = execSync(cmd)
        const regex = /^\..*/
        let folder_card = document.getElementsByClassName('folder_card')

        if (folder_card.length > 0) {
            for (let i = 0; i < folder_card.length; i++) {

                cmd = 'cd "' + href + '"; du -s'
                du = exec(cmd)

                console.log(href)

                du.stdout.on('data', function (res) {

                    let extra = folder_card[i].querySelector('.extra')

                    let size = parseInt(res.replace('.', '') * 1024)
                    if (size > 1000000000) {
                        extra.innerHTML = '<span style="color:red">' + get_file_size(size) + '</span>'
                    } else {
                        extra.innerHTML = get_file_size(size)
                    }

                    resolve(size)

                })


            }
        }

    } else {
        console.log('gvfs folder. dont scan size')
    }

})

}

function get_folder_size1 (href, callback) {

    cmd = 'cd "' + href + '"; du -s'
    du = exec(cmd)

    console.log(href)

    du.stdout.on('data', function (res) {

        let size = parseInt(res.replace('.', '') * 1024)
        callback(size)

    })
}

// CLEAR WORKSPACE
function clear_workspace() {
    workspace_arr = []
    if (localStorage.getItem('workspace')) {
        localStorage.setItem('workspace', '')
        let workspace_grid = document.getElementById('workspace_grid')
        let workspace_content = document.getElementById('workspace_content')
        workspace_content.classList.remove('active')
        workspace_grid.innerHTML = ''
    }

}

// GET WORKSPACE ITEMS
async function get_workspace() {

    if (localStorage.getItem('workspace')) {

        let items = JSON.parse(localStorage.getItem('workspace'))

        let workspace_content = document.getElementById('workspace_content')
        let workspace_grid = document.getElementById('workspace_grid')
        workspace_content.classList.add('active')

        workspace_grid.innerHTML = ''

        for (let i = 0; i < items.length; i++) {

            let item = items[i]
            let href = item

            options = {
                id: 'workspace_' + i,
                href: href,
                linktext: path.basename(href),
                grid: workspace_grid
            }

            workspace_arr.push(options.href)
            add_card(options)

        }

        update_cards(workspace_grid)

    }

}

// ADD ITEM TO WORKSPACE
let workspace_arr = []
function add_workspace() {

    let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')

    console.log('items length', items.length)

    if (items.length > 0) {

        let workspace_content = document.getElementById('workspace_content')
        let workspace = document.getElementById('workspace')
        let workspace_grid = document.getElementById('workspace_grid')
        workspace_content.classList.add('active')

        let file_exists = 0
        for (let i = 0; i < items.length; i++) {

            let stats = fs.statSync(items[i].dataset.href)
            let is_folder = stats.isDirectory()

            if (localStorage.getItem('workspace')) {
                let local_items = JSON.parse(localStorage.getItem('workspace'))
                for (let ii = 0; ii < local_items.length; ii++) {
                    if (items[i].dataset.href == local_items[0]) {
                        file_exists = 1
                        return
                    }
                }
            }

            if (!file_exists) {

                let item = items[i]
                let href = item.dataset.href

                options = {
                    id: 'workspace_' + i,
                    href: href,
                    linktext: path.basename(href),
                    grid: workspace_grid,
                    is_folder: is_folder
                }

                console.log('is folder', is_folder)

                workspace_arr.push(options.href)
                add_card(options)

                update_cards(workspace_grid)
                localStorage.setItem('workspace', JSON.stringify(workspace_arr))

            }

        }

    }
}

// QUICK SEARCH
function quick_search() {

    txt_search = document.getElementById('txt_search')

    txt_search.classList.remove('hidden')
    txt_search.focus()

    if (e.key === 'Enter') {

        cards = main_view.querySelectorAll('.nav_item')
        cards.forEach(card => {

            let href = card.dataset.href.toLocaleLowerCase()

            if (href.indexOf(txt_search.value.toLocaleLowerCase()) != -1) {
                card.classList.add('highlight_select')
                card.querySelector('a').focus()
            }

        })

    }
}

// GET TIME STAMP
function get_time_stamp(date) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

// LOAD VIEW
async function get_view(dir) {

    let view = localStorage.getItem('view');
    if (view == 'grid') {
        get_files(dir, () => {});
    } else if (view == 'list') {
        get_list_view(dir);
    }

}

// GET LIST VIEW
let sort_flag = 0;
async function get_list_view(dir) {

    let grid_view = document.getElementById('grid_view')
    let list_view = document.getElementById('list_view')

    list_view.innerHTML = ''

    grid_view.classList.add('hidden')
    list_view.classList.remove('hidden')

    let sort = parseInt(localStorage.getItem('sort'))

    const breadcrumbs = document.getElementById('breadcrumbs')
    breadcrumbs.classList.add('ui', 'breadcrumb')
    breadcrumbs.value = dir
    breadcrumbs.title = dir

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem('folder', dir)

    // DEFINE COLUMNS
    let cols_arr = [
        {
            name:'Name',
            sort: 2,
            show: 1
        },
        {
            name:'Size',
            sort: 3,
            show: 1
        },
        {
            name:'Modified',
            sort: 1,
            show: 1
        },
        {
            name:'Type',
            sort: 4,
            show: 1
        },
        {
            name: 'Created',
            sort: 5,
            show: 0
        }
    ]

    // READ DIRECTORY
    fs.readdir(dir, (err, dirents_arr) => {

        if (err) {

        } else {

            let table = document.createElement('table')
            let thead = document.createElement('thead')
            let tr = document.createElement('tr')
            let tbody = document.createElement('tbody')

            table.classList.add('ui','four', 'small', 'selectable', 'sortable', 'compact', 'celled', 'table')
            thead.classList.add('full-width')
            table.style = 'background:transparent !important;'

            table.append(thead)
            thead.append(tr)

            cols_arr.forEach((col, idx) => {

                if (col.show == 1) {

                    let th = document.createElement('th')
                    th.innerHTML = col.name
                    th.dataset.sort = idx + 1

                    th.addEventListener('click', (e) => {
                        let sort = col.sort
                        localStorage.setItem('sort', sort)
                        get_list_view(dir)
                    })

                    if (col.name == 'Name') {
                        th.classList.add('eight' , 'wide')
                    } else {
                        th.classList.add('two' , 'wide')
                    }

                    tr.append(th)

                }


            })

            // ADD TABLE TO LIST VIEW
            list_view.append(table)

            // REGEX FOR HIDDEN FILE
            const regex = /^\..*/

            let dirents = []
            let show_hidden = localStorage.getItem('show_hidden');
            if (show_hidden === '0' || show_hidden == '') {

                console.log('running filter ', show_hidden);
                dirents = dirents_arr.filter(a => !regex.test(a));

                console.log('regex length', dirents.length);
                console.log('dirents arr length', dirents_arr.length);


            } else {
                dirents = dirents_arr;
            }

            // SET SORT DIRECTION
            if (sort_flag == 0) {
                sort_flag = 1
            } else {
                sort_flag = 0
            }

            // SORT
            switch (parseInt(sort)) {

                // SORT BY DATE
                case 1: {

                    // SORT BY DATE DESC
                    dirents.sort((a, b) => {

                        try {

                            s1 = fs.statSync(path.join(dir, a)).mtime;
                            s2 = fs.statSync(path.join(dir, b)).mtime;

                            // SORT FLAG
                            if (sort_flag == 0) {
                                return s2 - s1
                            } else {
                                return s1 - s2
                            }

                        } catch (err) {
                            console.log(err)
                        }

                    })

                    break
                }

                // SORT BY NAME
                case 2: {

                    console.log('sort flag', sort_flag)
                    dirents.sort((a, b) => {
                        if (sort_flag == 0) {
                            return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
                        } else {
                            return b.toLocaleLowerCase().localeCompare(a.toLocaleLowerCase());
                        }
                    })

                    break;
                }

                // SORT BY SIZE
                case 3: {
                    dirents.sort((a,b) => {

                        let s1 = parseInt(localStorage.getItem(path.join(dir,a)));
                        let s2 = parseInt(localStorage.getItem(path.join(dir,b)));

                        if (sort_flag == 0) {
                            return s2 - s1;
                        } else {
                            s1 - s2;
                        }


                    })
                }

                // SORT BY TYPE
                case 4: {

                }
            }

            // SORT FOLDER FIRST
            dirents.sort((a, b) => {

                let breadcrumbs = document.getElementById('breadcrumbs')
                let a_filename = path.join(breadcrumbs.value, a)
                let b_filename = path.join(breadcrumbs.value, b)

                a_stats = fs.statSync(a_filename)
                b_stats = fs.statSync(b_filename)

                return (a_stats.isFile() === b_stats.isFile())? 1 : a_stats.isFile()? 0: -1;

            })

            let file0 = '';

            // LOOP OVER FILES
            dirents.forEach((file, idx) => {

                file0 = file;

                // GET FILE NAME
                let filename = path.join(dir, file)

                try {

                    // GET FILE STATS
                    let stats = fs.statSync(filename)

                    if (stats) {

                        let type = mime.lookup(filename)

                        if (!type) {
                            type = 'inode/directory'
                        }

                        // CREATE HEADER
                        let header_link = add_link(filename,file);
                        header_link.classList.add('nav_item;', 'header_link')
                        header_link.style = 'font-weight: normal !important; color:#cfcfcf !important; text-decoration: none !important; width: 100%'

                        // CREATE INPUT
                        let input = document.createElement('input')
                        input.type = 'text'
                        input.value = file
                        input.spellcheck = false
                        input.classList.add('hidden', 'input')
                        input.setSelectionRange(0, input.value.length - path.extname(filename).length)

                        // INPUT CHANGE EVENT
                        input.addEventListener('change', (e) => {
                            rename_file(filename, input.value)
                            input.classList.add('hidden')
                            header_link.classList.remove('hidden')
                            update_cards(document.getElementById('main_view'))
                        })

                        // CREATE TABLE ROW
                        let tr = document.createElement('tr')
                        tr.dataset.href = filename
                        tr.classList.add('nav_item')
                        tr.draggable = 'true'

                        // LOOP OVER COLUMNS
                        cols_arr.forEach(item => {

                            let box = add_div();
                            box.style = 'display:flex; align-items: center';

                            let td = document.createElement('td');
                            td.style = 'color: #cfcfcf; vertical-align: middle;';

                            if (item.show == '1') {

                                // ADD DATA
                                switch(item.name) {

                                    case 'Name': {

                                        box.append(add_img(get_icon_path(filename)), header_link, input);
                                        td.append(box);

                                        td.tabIndex = idx

                                        // td.addEventListener('mouseover', (e) => {

                                        //     let title =  {
                                        //         filename: filename,
                                        //         size: get_file_size(localStorage.getItem(filename)),
                                        //         modified: get_time_stamp(fs.statSync(filename).mtime)
                                        //     }

                                        //     e.target.title = title.filename +
                                        //                      '\n' +
                                        //                      title.size +
                                        //                      '\n' +
                                        //                      title.modified

                                        //     td.focus()

                                        //     // SET ACTIVE HREF FOR CONTEXT MENU
                                        //     active_href = filename

                                        // })

                                        // EDIT MODE
                                        td.addEventListener('keyup', (e) => {

                                            if (e.key === 'F2') {
                                                header_link.classList.add('hidden')
                                                input.classList.remove('hidden', 'input')
                                                input.select()
                                                input.focus()
                                            }

                                            if (e.key === 'Escape') {
                                                input.classList.add('hidden');
                                                input.value = file0;
                                                header_link.classList.remove('hidden');
                                            }

                                        })

                                        td.classList.add('card')

                                        break;
                                    }
                                    case 'Size': {
                                        td.append(get_file_size(localStorage.getItem(filename)));
                                        break;
                                    }
                                    case 'Modified': {
                                        td.append(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime));
                                        break;
                                    };
                                    case 'Type': {
                                        td.append(type);
                                        break;
                                    }
                                    case 'Created' : {
                                        td.append(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.ctime));
                                        break;
                                    }
                                }

                                tr.append(td)
                                // tr.addEventListener('click', (e) => {
                                //     td.classList.add('highlight_select')
                                // })

                                // tr.addEventListener('mouseover', (e) => {
                                //     td.classList.add('highlight')
                                // })

                                // tr.addEventListener('mouseout', (e) => {
                                //     td.classList.remove('highlight')
                                // })

                            }

                            // TABLE DATA MOUSEOVER
                            tr.addEventListener('mouseover', (e) => {

                                let title =  {
                                    filename: filename,
                                    size: get_file_size(localStorage.getItem(filename)),
                                    modified: get_time_stamp(fs.statSync(filename).mtime)
                                }

                                e.target.title = title.filename +
                                                 '\n' +
                                                 title.size +
                                                 '\n' +
                                                 title.modified

                                // FOCUS FOR EDIT
                                td.focus()

                                // HIGHLIGHT ROW
                                td.classList.add('highlight')

                                // SET ACTIVE HREF FOR CONTEXT MENU
                                active_href = filename

                            })

                            tr.addEventListener('mouseout', (e) => {
                                td.classList.remove('highlight')
                            })



                        })

                        // ADD TR TO TABLE BODY
                        tbody.appendChild(tr)

                        // DIRECTORY
                        if (stats.isDirectory()) {

                            header_link.addEventListener('click', (e) => {
                                get_list_view(filename)
                            })

                        // FILES
                        } else {

                            header_link.addEventListener('click', (e) => {
                                open(filename, {wait: false})
                            })

                            // tr.append(td)
                            // tbody.appendChild(tr)


                        }

                    }

                } catch (er) {

                }

            })

            // ADD TABLE BODY  TO TABLE
            table.append(tbody)

            // UPDATE CARDS
            update_cards(document.getElementById('main_view'))

            // GET DISK USAGE STATS
            ipcRenderer.send('get_disk_space', { href: dir, folder_count: folder_count, file_count: file_count })

            // LAZY LOAD IMAGES
            lazyload()


        }

    })

    // SHOW SIDEBAR
    if (localStorage.getItem('sidebar') == 1) {
        show_sidebar()
    } else {
        hide_sidebar()
    }

    // let sidebar = document.getElementById('sidebar')
    // sidebar.addEventListener('mouseover', (e) => {
    //     sidebar.focus()
    // })

}

let card_counter = 0
// MAIN GET FILES FUNCTION
async function get_files(dir, callback) {

    if (!fs.existsSync(dir)) {
        return false
    }

    show_loader()

    let grid_view = document.getElementById('grid_view')
    let list_view = document.getElementById('list_view')

    grid_view.classList.remove('hidden')
    list_view.classList.add('hidden')


    add_history(dir)
    // console.log(history_arr)

    options.sort = localStorage.getItem('sort')
    options.page = localStorage.getItem('page')

    // HANDLE COUNTER
    cardindex = 0

    // NEED TO FIGURE OUT WHAT THIS IS DOING


    if (start_path) {
        dir = start_path
        start_path = ''
    }

    if (options.page == '') {
        options.page = 1
    }

    const breadcrumbs = document.getElementById('breadcrumbs')
    breadcrumbs.value = dir
    breadcrumbs.title = dir

    // SET FOLDER TO LOCAL STORAGE
    localStorage.setItem('folder', dir)

    // GET REFERENCES
    let main_view = document.getElementById('main_view');
    let info_view = document.getElementById('info_view');
    let folder_grid = document.getElementById('folder_grid');
    let hidden_folder_grid = document.getElementById('hidden_folder_grid');
    let file_grid = document.getElementById('file_grid');
    let hidden_file_grid = document.getElementById('hidden_file_grid');
    let pager = document.getElementById('pager');

    file_grid.innerHTML = '';
    folder_grid.innerHTML = '';

    // HANDLE QUIT
    // LOOP OVER QUIT
    let quit = document.getElementsByClassName('quit')
    for (let i = 0; i < quit.length; i++) {
        quit[i].addEventListener('click', (e) => {
            ipcRenderer.send('close')
        })
    }

    // HANDLE MINIMIZE
    let min = document.getElementById('min')
    min.addEventListener('click', function (e) {
        ipcRenderer.send('minimize')
    })


    // HANDLE MAXAMIZE
    let max = document.getElementById('max')
    max.addEventListener('click', function (e) {
        ipcRenderer.send('maximize')
    })

    // CLEAR ITEMS
    folder_grid.innerText = ''
    hidden_folder_grid.innerText = ''
    file_grid.innerText = ''
    hidden_file_grid.innerText = ''
    pager.innerHTML = ''

    // HANDLE GNOME DISKS BUTTON
    let gnome_disks = document.querySelectorAll('.gnome_disks')
    gnome_disks.forEach(function (e) {
        e.addEventListener('click', function (e) {
            ipcRenderer.send('gnome_disks')
        })
    })

    // DISK USAGE ANALYZER
    let dua = document.getElementById('menu_dua')
    dua.addEventListener('click', function (e) {
        ipcRenderer.send('dua', { dir: breadcrumbs.value })
    })

    // GET CONTROL OPTIONS FROM LOCAL STORAGE. SUCH AS SORT
    let btn_show_hidden = document.getElementById('btn_show_hidden_folders')
    let show_hidden = localStorage.getItem('show_hidden')

    // SHOW HIDDEN FILES
    if (show_hidden === '1') {
        btn_show_hidden.classList.add('active')
        hidden_folder_grid.classList.remove('hidden')
        hidden_file_grid.classList.remove('hidden')
    } else {
        hidden_folder_grid.classList.add('hidden')
        hidden_file_grid.classList.add('hidden')
        btn_show_hidden.classList.remove('active')
    }

    //
    let sort = parseInt(localStorage.getItem('sort'))
    switch (sort) {
        case 1:
            sort_by_date.classList.add('active')
            break
        case 2:
            sort_by_name.classList.add('active')
            break
        case 3:
            sort_by_size.classList.add('active')
            break
        case 4:
            sort_by_type.classList.add('active')
            break
    }

    // GET FILES ARRAY
    let rd_st = new Date().getTime()
    fs.readdir(dir, (err, dirents) => {

        if (err) {
            notification('error: ' + err)
        }
        if (dirents.length > 0) {

            // CLEAR INFO VIEW
            info_view.innerHTMl = ''

            // SORT BY DATE
            if (sort == 1) {

                // SORT START TIME
                sort_st = new Date().getTime()

                // SORT BY DATE
                dirents.sort((a, b) => {

                    try {
                        let s1 = stat.statSync(path.join(dir, a))
                        let s2 = stat.statSync(path.join(dir, b))

                        return s2.mtime - s1.mtime

                    } catch (err) {
                        console.log(err)
                    }

                })
            }

            // SORT BY NAME
            if (sort == 2) {

                // SORT Y NAME
                dirents = dirents.sort((a, b) => {
                    if (a.toLocaleLowerCase() < b.toLocaleLowerCase()) {
                        return -1;
                    }
                    if (a.toLocaleLowerCase() > b.toLocaleLowerCase()) {
                        return 1;
                    }
                    return 0;
                })

            }

            // SORT BY SIZE
            if (sort == 3) {

                // SORT BY SIZE
                dirents.sort((a, b) => {

                    let s1 = parseInt(localStorage.getItem(path.join(dir,a)))
                    let s2 = parseInt(localStorage.getItem(path.join(dir,b)))

                    return s2 - s1

                })

            }

            // SORT BY TYPE
            if (sort == 4) {


                dirents.sort((a, b) => {

                    try {

                        let s1 = stat.statSync(dir + '/' + a)
                        let s2 = stat.statSync(dir + '/' + b)

                        let ext1 = path.extname(path.basename(a))
                        let ext2 = path.extname(path.basename(b))

                        if (ext1 < ext2) return -1
                        if (ext1 > ext2) return 1

                        if (s1.mtime < s2.mtime) return -1
                        if (s1.mtime > s2.mtime) return 1

                    } catch {
                        console.log(err)
                    }

                })

            }

            // REGEX FOR HIDDEN FILE
            const regex = /^\..*/

            // PAGE FILES
            if (dirents.length > pagesize) {

                let number_pages = parseInt(parseInt(dirents.length) / parseInt(pagesize))

                for (let i = 1; i < number_pages + 1; i++) {

                    add_pager_item({ dir, name: i })

                }

                dirents = paginate(dirents, pagesize, page)

            }

            // HANDLE GROUP BY
            let groupby = 1
            let exts = dirents.filter((a) => {

                let ext1 = path.extname(a)
                let ext2 = path.extname(a)

                if (ext1 > ext2) return -1
                if (ext1 < ext2) return 1

            })


            if (groupby) {

                exts.forEach(ext => {

                    console.log('extension ', ext)

                    dirents.forEach((file, idx) => {

                        if (path.extname(file) == ext) {
                            console.log('extension ', file)
                        }

                    })


                })

            }

            dirents.forEach((file, idx) => {

                try {

                    let filename = file
                    let filepath = path.join(dir, filename)

                    let stats = fs.statSync(filepath)

                    // DIRECTORY
                    if (stats.isDirectory()) {

                        let options = {
                            id: 'folder_card_' + idx,
                            href: filepath,
                            linktext: filename,
                            size: '',
                            is_folder: true
                        }

                        if (!regex.test(file)) {

                            options.grid = folder_grid

                        } else {

                            options.grid = hidden_folder_grid

                        }

                        add_card(options)
                        ++folder_count

                    // FILES
                    } else {

                        let filename = path.basename(file)
                        let filepath = path.join(dir, '/', filename)

                        if (groupby) {

                            let ext = path.extname(filename)

                        } else {

                        }

                        let options = {
                            id: 'file_card_' + idx,
                            href: filepath,
                            linktext: filename,
                            is_folder: false,
                            card_counter: card_counter
                        }

                        if (!regex.test(file)) {
                            options.grid = file_grid
                        } else {
                            options.grid = hidden_file_grid
                        }

                        add_card(options)
                        ++file_count

                    }

                } catch (err) {

                    console.log(err)

                }

            })

            /////////////////////////////////////////////////////////////////////

            // // PAGE FILES
            // if (dirents.length > pagesize) {

            //     let number_pages = parseInt(parseInt(dirents.length) / parseInt(pagesize))

            //     for (let i = 1; i < number_pages + 1; i++) {

            //         add_pager_item({ dir, name: i })

            //     }

            //     dirents = paginate(dirents, pagesize, page)

            // }

            hide_loader()

            // GET DISK SPACE
            // console.log('folder count ' + folder_count + ' file count ' + file_count)
            // notification('loaded ' + folder_count + ' folders ' + file_count + ' files')

            if (dir.indexOf('/gvfs') === -1) {

                ipcRenderer.send('get_disk_space', { href: dir, folder_count: folder_count, file_count: file_count })

                // GET DISK USAGE CHART
                get_disk_usage_chart()

            }

            // UPDATE CARDS
            update_cards(grid_view)

            // let header = document.getElementsByClassName('.header_link')
            // header[0].focus()

            callback(1)

            let filename0 = ''
            fs.watch(dir, (e, filename) => {

                if (filename0 != filename) {

                    filename0 = filename

                    // console.log('filename', filename)

                    //         let href = path.join(dir, filename)
                    //         if (fs.existsSync(path.join(dir, filename))) {
                    //             if (e == 'change') {

                    //                 options = {
                    //                     id: 'file_card_0',
                    //                     href: href,
                    //                     linktext: filename,
                    //                     grid: file_grid
                    //                 }
                    //                 console.log('adding card', options)
                    //                 add_card(options)
                    //                 // update_cards(main_view)
                    //                 pfile = filename


                    //             }
                    //         }

                    //         console.log(e)
                    //         console.log(filename)

                }


            })

            // let cards = document.querySelectorAll('.card')
            // cards.forEach(item => {
            //     console.log(item)
            // })

            // let lazy = [].slice.call(document.querySelectorAll('.file_card'))
            // if ("IntersectionObserver" in window) {

            //     let lazyObserver = new IntersectionObserver(function(entries, observer) {

            //         notification('Running lazy file card')

            //         entries.forEach(function(entry) {
            //             if (entry.isIntersecting) {
            //             let lazy = entry.target;

            //             // THIS NEEDS TO CHANGE TO HANDLE CARD
            //             lazy.src = lazy.dataset.src;
            //             lazy.srcset = lazy.dataset.src;


            //             lazy.classList.remove("lazy");
            //             lazyObserver.unobserve(lazy);
            //             }
            //         })

            //     })

            //     lazy.forEach(function(lazy) {
            //         notification('running observe')
            //         lazyObserver.observe(lazy)
            //     })

            // } else {
            //     // Possibly fall back to event handlers here
            // }




            // LAZY LOAD IMAGES
            lazyload()

            let sidebar = document.getElementById('sidebar')
            sidebar.addEventListener('mouseover', (e) => {
                sidebar.focus()
            })


            // HANDLE QUICK SEARCH KEY PRESS. THIS IS FOR FIND BY TYPING //////////////////////////////////
            let letters = ''
            let txt_search = document.getElementById('txt_search')

            // MAIN VIEW
            main_view.tabIndex = 0

            // KEYBOARD NAVIGATION
            main_view.addEventListener('keypress', function (e) {

                console.log('pressing key ', e.key)

                // PEVENT KEYPRESS FROM BEING FIRED ON QUICK SEARCH AND FIND
                e.stopPropagation()
                console.log('main view key code is ' + e.key)

                // LOOK FOR LETTERS AND NUMBERS. I DONT THINK THIS
                // let regex = /[^A-Za-z0-9]+/
                let regex = /[^A-Za-z0-9]+/

                // TEST FOR LETTERS AND NUMBERS
                if (regex.test(e.key) === false && !e.shiftKey && e.key !== 'Delete' && !e.ctrlKey) {

                    // MAKE SURE WHERE NOT SOMETHING THAT WE NEED
                    if (e.target === e.currentTarget || e.target === txt_search || e.target.classList.contains('header_link')) {

                        txt_search.classList.remove('hidden')
                        txt_search.focus()

                        if (e.key === 'Enter') {

                            cards = main_view.querySelectorAll('.nav_item')
                            cards.forEach(card => {
                                let href = card.dataset.href.toLocaleLowerCase()
                                if (href.indexOf(txt_search.value.toLocaleLowerCase()) != -1) {
                                    card.classList.add('highlight_select')
                                    card.querySelector('a').focus()
                                }
                            })

                            txt_search.classList.add('hidden')

                            // })

                        }

                    }

                }

            })

            // DISABLE MOVING CONTENT ON ARROW
            document.addEventListener('keydown', (e) => {
                if (["ArrowUp","ArrowDown"].indexOf(e.code) > -1) {
                    e.preventDefault()
                    console.log('arrow key pressed')
                    return false
                }
            })

            // HIDE QUICK SEARCH
            txt_search.addEventListener('keydown', function (e) {

                // if (e.key === 'Escape' || e.key === 'Tab') {
                if (e.key === 'Escape') {

                    // CLEAR ITEMS
                    console.log('esc pressed on keydown')

                    clear_selected_files()
                    // CLEAR COPY ARRAY
                    // copy_files_arr = []

                }

            })

            // DRAG AMD DROP
            // moved this to the update_cards function
            // ds.addSelectables(document.getElementsByClassName('nav'), false)
            // ds.subscribe('elementselect', ({items,item}) => {
            //     console.log(item.dataset.href)
            //     // add_copy_file(item.dataset.href, item.id)
            // })
            // ds.subscribe('elementunselect', ({items, item}) => {
            //     // remove_copy_file(item.dataset.href)
            //     console.log(copy_files_arr.length)
            // })

            // ds.subscribe('predragstart', ({ isDragging, isDraggingKeyboard }) => {
            //     if(isDragging) {
            //         ds.stop(false,false)
            //         // setTimeout(ds.start)
            //     }
            // })

            /////////////////////////////////////////////////////////////////////

            // ON DRAG START
            // main_view.ondragstart = function (e) {
            // }

            // ON DRAG ENTER
            main_view.ondragenter = function (e) {

                // dragging++

                destination = breadcrumbs.value
                target = e.target

                e.preventDefault()
                e.stopPropagation()

                return false
            };

            // DRAG OVER
            main_view.ondragover = function (e) {

                e.stopPropagation()
                e.preventDefault()

                return false

            }

            main_view.ondragleave = (e) => {

                e.preventDefault()
                console.log('leaving main window')
                return false

            }

            // ON DROP
            let state = 0
            main_view.ondrop = function (e) {

                e.preventDefault();

                const file_data = e.dataTransfer.files

                // GETTING FILE DROPED FROM EXTERNAL SOURCE
                if (file_data.length > 0) {
                    for (let i = 0; i < file_data.length; i++) {
                        add_copy_file(file_data[i].path, 'card_' + i)
                    }
                }

                console.log('on drop main view destination ' + destination)

                // COPY FILES
                if (e.ctrlKey == true) {

                    // alert('test')
                    // notification('running copy files on main_view ' + destination)

                    // if the place you copy to is breadcrumbs then 2 else 1

                    console.log('bread crumb', breadcrumbs.value, 'destination', destination, 'state', state)
                    if (breadcrumbs.value == destination) {
                        state = 2
                    } else {
                        state = 0
                    }

                    console.log('state', state)

                    // THIS IS RUNNING COPY FOLDERS TOO
                    copy_files(destination, state)

                    console.log('destination ' + destination)

                // MOVE FILE
                } else {

                    // notification('changing state to 0')

                    move_to_folder(destination, state)

                    clear_selected_files()
                    clear_copy_arr()

                }

                return false

            }

            document.getElementById('main_view').focus()

            // // WORSPACE
            // // POPULATE WORKSPACE
            // workspace_arr = []
            // get_workspace()

            let clearworkspace = document.getElementById('clear_workspace')
            clearworkspace.addEventListener('click', function (e) {
                clear_workspace()
            })

            let workspace = document.getElementById('workspace')

            // workspace.draggable = true

            // WORKSPACE ON DRAG ENETER
            workspace.ondragenter = function (e) {
                e.preventDefault()

                notification('om drag enter workspace')
                workspace_content.classList.add('active')
                // workspace.style = 'height:140px;'

                return false

            }

            workspace.ondragover = (e) => {
                console.log('workspace on drag over')
                return false
            }

            workspace.ondragleave = function (e) {
                e.preventDefault()
                return false
            }

            workspace.ondrop = (e) => {
                // e.preventDefault()
                console.log('workspace on drop')
                add_workspace()

            }

            // navigator.clipboard.write([
            //     new ClipboardItem({
            //         'image/png': pngImageBlob
            //     })
            // ]);


            // WORKSPACE CONTENT
            let workspace_content = document.getElementById('workspace_content')
            workspace_content.height = '40px'


            workspace_content.ondragenter = function (e) {
                notification('running on drag enter workspace content')
                e.preventDefault()
            }

            workspace_content.ondragover = function (e) {
                e.preventDefault()
            }

            workspace_content.ondrop = function (e) {

                notification('running workspace on drop ')

            }

            // RESET CARD INDEX TO 0 SO WE CAN DETECT WHEN SINGLE CARDS ARE ADDED
            cardindex = 0
            notice(' (' + directories.length + ') directories and (' + files.length + ') files')

        } else {

            hide_loader()

            // let img = document.createElement('img')
            // img.src = path.join(__dirname, 'assets/icons/folder.png')
            // img.width = '48'
            // img.height = '48'

            info_view.append('Folder is empty')
            info_view.style = 'font-size: 23px; height: 100%; position:fixed; left: 50%; top: 50%'

            return false
        }

        info_view.innerHTML = ''

    })


    // // GET DISK SPACE
    // get_diskspace(dir)

    // console.log('folder count ' + folder_count + ' file count ' + file_count)
    // ipcRenderer.send('get_disk_space', { dir: dir, folder_count: folder_count, file_count: file_count } )

    ///////////////////////////////////////////////////////////////////////

    let folder_cards = document.getElementsByClassName('folder_card')
    let items = document.querySelectorAll('.nav_item')
    let headers = document.getElementsByClassName('header_link')


    nc = 1
    nc2 = 0
    adj = 0
    is_folder_card = true

    // // ALT+E EXTRACT
    // Mousetrap.bind('shift+e', (e) => {

    //     e.preventDefault()
    //     console.log('extracting file')

    //     // let selected_items = document.getElementsByClassName('highlight, highlight_select, ds-selected')
    //     // selected_items.forEach(item => {
    //     // })

    //     let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
    //     if (items.length > 0) {

    //         // LOOP OVER ITEMS AND ADD TO DELETE ARRAY
    //         for (let i = 0; i < items.length; i++) {

    //             let item = items[i]
    //             let href = item.getAttribute('data-href')

    //             extract(href)

    //         }
    //     }


    // })

    // Mousetrap.bind('shift+c', (e) => {

    //     let href = ''
    //     if (items.length > 0) {
    //         for (let i = 0; i < items.length; i++) {

    //             let item = items[i]

    //             if (item.classList.contains('highlight') || item.classList.contains('highlight_select')) {
    //                 href = item.dataset.href
    //                 console.log('source ' + href)
    //                 compress(href)
    //             }
    //         }
    //     }

    // })


    // // KEYBOARD SHORTCUTS SECTION
    // Mousetrap.bind('ctrl+a', (e) => {

    //     e.preventDefault()

    //     let card = document.getElementsByClassName('highlight')

    //     if (card.length > 0) {

    //         let grid = card[0].closest('.grid')
    //         let cards = grid.getElementsByClassName('card')

    //         for (let i = 0; i < cards.length; i++) {
    //             cards[i].classList.add('highlight_select')
    //         }

    //     } else {

    //         let main_view = document.getElementById('main_view')
    //         let nav_item = main_view.querySelectorAll('.nav_item')
    //         nav_item.forEach(item => {
    //             item.classList.add('highlight_select')

    //         })
    //         info(nav_item.length + ' items selected')

    //     }

    // })


    // // CTRL S SHOW SIDEBAR
    // Mousetrap.bind('ctrl+b', (e) => {

    //     let sidebar = document.getElementById('sidebar')

    //     console.log(sidebar.hidden)

    //     if (sidebar.classList.contains('hidden')) {

    //         show_sidebar()
    //         localStorage.setItem('sidebar', 1)
    //         console.log('show side bar')

    //     } else {
    //         hide_sidebar()
    //         localStorage.setItem('sidebar', 0)
    //         console.log('hide side bar')
    //     }

    // })

    let down = 1
    let up = 1
    let left = 1
    let right = 1

    let keycounter = 0
    let keycounter0 = 0

    let is_last = 0
    let is_last0 = 0

    // RIGHT
    Mousetrap.bind('shift+right', (e) => {


        e.preventDefault()
        // if (nc > 0) {
        nc = nc2
        nc2 = nc2 + 1
        console.log('nc2 ' + nc2)
        console.log('nc ' + nc)

        // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
        document.querySelector("[data-id='" + (nc2) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (nc2) + "']").querySelector('a').focus()
        // headers[nc2 - 1].focus()

        // }

    })

    // RIGHT
    Mousetrap.bind('right', (e) => {

        keycounter0 = keycounter

        if (keycounter < 1) {
            keycounter = 1
        } else {
            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
            keycounter += 1
        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

        console.log(keycounter, keycounter0, folder_cards.length)

    })

    // SHIFT LEFT. MULTI SELECT
    Mousetrap.bind('shift+left', (e) => {

        // e.preventDefault()

        // if (nc2 > 1) {

        //     nc = nc2
        //     nc2 = nc2 - 1

        //     console.log('nc2 ' + nc2)
        //     console.log('nc ' + nc)

        //     // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
        //     document.querySelector("[data-id='" + (nc2) + "']").classList.add('highlight_select')
        //     document.querySelector("[data-id='" + (nc2) + "']").querySelector('a').focus()
        //     // headers[nc2 - 1].focus()

        // }
    })

    // LEFT
    Mousetrap.bind('left', (e) => {

        keycounter0 = keycounter

        if (keycounter <= 1) {
            keycounter = 1
        } else {
            document.querySelector("[data-id='" + (keycounter) + "']").classList.remove('highlight_select')
            keycounter -= 1
        }

        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

        console.log(keycounter, keycounter0, folder_cards.length)

    })

    // HANDLE SHIFT DOWN MULTI SELECTION
    Mousetrap.bind('shift+down', function (e) {

        e.preventDefault()

        if (nc2 == 0) {

            document.querySelector("[data-id='" + (nc) + "']").classList.add('highlight_select')
            headers[nc - 1].focus()

            nc2 = 1

        } else {

            // NC = ACTUAL LOCATION
            nc = nc2
            nc2 = nc2 + 5

            // DONT AJUST IF LESS THAN NAV COUNTER
            if (nc2 > 1) {

                // HANDLE MOVING BETWEEN GRIDS
                if (localStorage.getItem('show_hidden') == '0') {

                    adj = folder_count

                }

                if (nc2 > adj && is_folder_card == true) {

                    is_folder_card = false

                    //THIS EQUALS 25
                    let last_row_count = Math.ceil(folder_count / 5) * 5

                    if (localStorage.getItem('show_hidden') == '0') {

                        // THIS SHOULD = 1 IF FOLDER COUNT = 24 + COUNT OF HIDDEN DIRECTORIES
                        adj = 5 - (last_row_count - folder_count) + hidden_folder_count
                        nc2 = nc + adj

                    } else {

                        adj = hidden_folder_count

                    }

                }

                // document.querySelector("[data-id='" +  (nc) + "']").classList.remove('highlight_select')
                document.querySelector("[data-id='" + (nc2) + "']").classList.add('highlight_select')
                document.querySelector("[data-id='" + (nc2) + "']").querySelector('a').focus()
                // headers[nc2 - 1].focus()

            }

        }

    })

    // HANDLE KEYBOARD DOWN. DONT CHANGE
    Mousetrap.bind('down', (e) => {

        keycounter0 = keycounter

        let min = Math.floor(folder_cards.length / 5) * 5
        let diff = (Math.ceil(folder_cards.length / 5) * 5) - folder_cards.length

        is_last0 = is_last

        // CHECK IF LAST ROW
        if (keycounter > min) {
            is_last = 1
        }

        //
        if (keycounter < 1) {
            keycounter = 1
        } else {

            keycounter += 5

            // ADJUST SECOND TO LAST ROW
            if (keycounter > folder_cards.length && is_folder_card && !is_last) {
                keycounter = keycounter + (5 - diff)
                is_folder_card = 0
                // ADJUST LAST ROW
            } else if (keycounter > folder_cards.length && is_folder_card && is_last) {
                keycounter = keycounter0 + (5 - diff)
                is_folder_card = 0
                is_last = 0
            }

            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
        }

        console.log(keycounter, keycounter0, folder_cards.length, diff)
        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

        // items.forEach(item => {
        //     items.classList.remove('highlight')
        // })


    })

    // todo: check hidden files
    Mousetrap.bind('up', (e) => {

        keycounter0 = keycounter

        let min = Math.floor(folder_cards.length / 5) * 5
        let diff = 5 - ((Math.ceil(folder_cards.length / 5) * 5) - folder_cards.length)

        if (keycounter - 5 < min && !is_folder_card) {
            is_last = 1
            console.log('eurika')
        }

        if (keycounter <= 1) {
            keycounter = 1
        } else {

            keycounter -= 5

            if (keycounter < folder_cards.length && !is_folder_card && is_last) {

                keycounter = keycounter - diff
                is_folder_card = 1

            } else if (keycounter < folder_cards.length && !is_folder_card && !is_last) {

                keycounter = keycounter0 - diff
                is_folder_card = 1

            }

            document.querySelector("[data-id='" + (keycounter0) + "']").classList.remove('highlight_select')
        }

        console.log(keycounter, folder_cards.length)
        document.querySelector("[data-id='" + (keycounter) + "']").classList.add('highlight_select')
        document.querySelector("[data-id='" + (keycounter) + "']").querySelector('a').focus()

    })

    // SHOW SIDEBAR
    if (localStorage.getItem('sidebar') == "1") {
        show_sidebar()
    }

    // DEL DELETE KEY
    Mousetrap.bind('del', (e, res) => {

        console.log('running del')

        // delete_arr = []

        items = []
        items = document.querySelectorAll('.highlight_select, .ds-selected')
        // let items = document.getElementsByClassName('ds-selected')


        console.log(items.length)

        let source = ''
        if (items.length > 0) {

            for (let i = 0; i < items.length; i++) {

                let item = items[i]

                source += item.getAttribute('data-href') + '\n'

                let file = {
                    source: item.getAttribute('data-href'),
                    card_id: item.id
                }

                delete_arr.push(file)
            }

            ipcRenderer.send('confirm_file_delete', source)

        }

    })

    // CTRL-L - LOCATION
    Mousetrap.bind('ctrl+l', (e, res) => {
        let breadcrumb = document.getElementById('breadcrumbs')

        breadcrumb.focus()
        breadcrumb.select()
    })


    // CTRL V - PASTE
    Mousetrap.bind('ctrl+v', () => {

        // PAST FILES
        paste()

    })


    // NEW WINDOW
    Mousetrap.bind('ctrl+n', () => {
        // window.open('../src/index.html','_blank', 'width=1600,height=800,frame=false')
        ipcRenderer.send('new_window')
    })


    // NEW FOLDER
    Mousetrap.bind('ctrl+shift+n', () => {
        create_folder(breadcrumbs.value + '/Untitled Folder')

    })


    // RENAME
    Mousetrap.bind('f2', () => {

        console.log('f2 pressed')

        let cards = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
        if (cards.length > 0) {
            cards.forEach(card => {

                if (card) {

                    let header = card.querySelector('a')
                    header.classList.add('hidden')

                    let input = card.querySelector('input')
                    input.spellcheck = false
                    input.classList.remove('hidden')
                    input.setSelectionRange(0, input.value.length - path.extname(header.href).length)
                    input.focus()


                    console.log('running focus')


                }

            })
        }

    })

    // RELOAD
    Mousetrap.bind('f5', () => {

        // get_tree(breadcrumbs.value)
        let view = localStorage.getItem('view')
        if (view == 'grid') {
            get_files(breadcrumbs.value, () => {});
        } else if (view == 'list') {
            get_list_view(breadcrumbs.value);
        }


        localStorage.setItem('folder', breadcrumbs.value)

    })

    // FIND
    Mousetrap.bind('ctrl+f', () => {
        find_files();
    })


    // // LEFT
    // let left = document.getElementById('left')
    // left.addEventListener('click', function (e) {

    //     // alert('test')
    //     ipcRenderer.send('go_back', 'test')


    // })

    // CTRL C COPY
    Mousetrap.bind('ctrl+c', (e) => {

        let highlight = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');

        let folder_count = 0
        let file_count = 0

        if (highlight.length > 0) {

            let source
            let card_id
            let c1 = 0;
            let c2 = 0;
            highlight.forEach((item, idx) => {

                source = item.querySelector('a').getAttribute('href')

                stats = fs.statSync(source)

                if (stats.isDirectory()) {
                    folder_count += 1
                } else {
                    file_count += 1
                }

                card_id = item.id
                add_copy_file(source, card_id)

                if (fs.statSync(source).isDirectory()) {
                    ++c1;
                } else {
                    ++c2;
                }

            })

            notification(c1 + ' Folers ' + c2 + ' Files copied');

        }

    })

    // CTRL+X CUT
    Mousetrap.bind('ctrl+x', (e) => {

        let highlight = document.querySelectorAll('.highlight, .highlight_select, .ds-selected');

        // SET CUT FLAG TO 1
        cut_files = 1;


        let folder_count = 0;
        let file_count = 0;

        if (highlight.length > 0) {

            let source = '';
            let card_id = '';

            highlight.forEach((item, idx) => {

                source = item.querySelector('a').getAttribute('href');
                item.style = 'opacity: 0.6 !important';
                item.classList.remove('ds-selected');

                stats = fs.statSync(source);

                if (stats.isDirectory()) {
                    folder_count += 1;
                } else {
                    file_count += 1;
                }

                card_id = item.id;
                add_copy_file(source, card_id);

            })
        }

    })


    // ESC KEY
    Mousetrap.bind('esc', () => {

        clear_copy_arr()
        clear_selected_files()
        console.log('esc pressed')

    })

    // BACKSPACE
    Mousetrap.bind('backspace', () => {

        console.log('back pressed')
        navigate('left')

    })

    // GET DISK SPACE
    // get_diskspace(dir)

    // ipcRenderer.send('get_disk_space', { href: dir, folder_count: folder_count, file_count: file_count })

    // ipcRenderer.on('diskspace', (df) => {
    //     console.log(df)
    // })

    // TESTING GET DEVICE LIST
    // const filters = [
    //     {vendorId: 0x1209, productId: 0xa800},
    //     {vendorId: 0x1209, productId: 0xa850}
    // ];
    // navigator.usb.requestDevice({filters: filters})
    // .then(usbDevice => {
    //     console.log("Product name: " + usbDevice.productName);
    // })
    // .catch(e => {
    //     console.log("There is no device. " + e);
    // });

    // UPDATE CARD ID'S
    // if (dir.indexOf('/gvfs') === -1) {
    // update_cards(main_view)

    // }

    clear_selected_files()
    // notification('done loading files')

    // let cards = document.querySelectorAll('.card')
    // return callback = cards

}

// GET HOME DIRECTORY
function get_home() {
    return os.homedir()
}


// CONTEXT BRIDGE
contextBridge.exposeInMainWorld('api', {

    add_card: (options) => {
        add_card(options)
    },
    // get_gio_devices: () => {
    //     get_gio_devices()
    // },
    get_folder_size: () => {
        get_folder_size()
    },
    find_files: () => {
        find_files()
    },
    get_disk_usage: () => {
        get_disk_usage()
    },
    get_folders1: (dir) => {
        return get_folders1(dir)
    },
    get_tree: (dir) => {
        return get_tree(dir)
    },
    get_files: (dir, callback) => {
        return get_files(dir, callback)
    },
    get_list_view: (dir) => {
        return get_list_view(dir)
    },
    get_network: () => {
        return get_network()
    },
    get_icon_path: (path) => {
        return get_icon_path(path)
    },
    get_data: (dir) => {
        return get_data(dir)
    },
    get_home: () => {
        return get_home()
    },
    navigate: (direction) => {
        navigate(direction)
    },
    get_terminal: () => {
        get_terminal()
    }

})

function add_history(dir) {

    if (history_arr.length > 0) {

        if (history_arr.every(x => x != dir)) {
            if (fs.existsSync(dir)) {
                history_arr.push(dir)
            }
        }

    } else {

        if (fs.existsSync(dir)) {
            history_arr.push(dir)
        }


    }
}


let copy_files_arr = []
function add_copy_file(source ,card_id) {

    let c1 = 0;
    let c2 = 0;
    if (source == '' || card_id == '') {

    } else {

        if (copy_files_arr.length > 0) {

            if (copy_files_arr.every(x => x.source != source)) {

                console.log('adding selected file ' + source)
                console.log('card id is ' + card_id)

                let file = {
                    card_id: card_id,
                    source: source,
                    size: localStorage.getItem(source),
                    destination: ''
                }

                copy_files_arr.push(file)

                // ADDING MAIN COPY FILES ARRAY
                ipcRenderer.send('add_copy_files', copy_files_arr)
            }

        } else {

            let file = {
                card_id: card_id,
                source: source,
                size: localStorage.getItem(source),
            }

            copy_files_arr.push(file)
            ipcRenderer.send('add_copy_files', copy_files_arr)

        }
    }

    console.log('copy files array', copy_files_arr.length)

}

// REMOVE COPY FILE
function remove_copy_file(href) {

    copy_files_arr.forEach((item, idx) => {

        if (item.source == href) {
            copy_files_arr.splice(idx)
        }

    });
}

// ADD TO SELECTED FILES ARRAY
function add_selected_file(source, card_id) {

    //

    if (source == '' || card_id == '') {
        console.log('error line #2955: empty source or card_id')
    } else {

        if (selected_files.length > 0) {

            if (selected_files.every(x => x.source != source)) {

                console.log('adding selected file ' + source)
                console.log('card id is ' + card_id)

                let file = {
                    card_id: card_id,
                    source: source
                }

                // selected_files.push(file)
                console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')
                notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')

            }

        } else {

            let file = {
                card_id: card_id,
                source: source
            }

            selected_files.push(file)
            console.log('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')
            notification('Added source ' + file.source + ' card_id ' + file.card_id + ' to the selected files array')

        }

    }

}

// REMOVE FILE FROM SELECTED FILES ARRAY
function remove_selected_file(source) {

    console.log('removing')

    // let card = document.getElementById(card_id)
    // card.classList.add('highlight_select')

    // let file_idx = selected_files.indexOf()
    // selected_files.splice(file_idx,1)


    //   let selected_files_list = document.getElementById('selected_files_list')
    //   selected_files_list.innerHTML = ''

    // LOOP OVER SELECTED FILES ARRAY
    // selected_files.forEach((file, idx) => {

    //     if (file.source == source) {
    //         console.log('removed selected file ' + source)
    //         notification('removed selected file ' + source)
    //         console.log('length ' + selected_files.length)

    //         // selected_files.pop()

    //         console.log('length ' + selected_files.length)

    //     }

    //     // console.log('running ' + idx)

    //     // // CREATE ITEM
    //     // let item = add_div()

    //     // // ADD NAME TO ITEM
    //     // item.innerText = file

    //     // // APPEND TO SELECTED FILES LIST
    //     // selected_files_list.appendChild(item)

    // })

}

function clear_highlight() {

    let cards = document.querySelectorAll('.card')
    cards.forEach((card, idx) => {
        if (card.classList.contains('highlight')) {
            card.classList.remove('highlight')
        }
    })

}

function clear_highlight_select() {

    let cards = document.querySelectorAll('.card')
    cards.forEach((card, idx) => {
        card.classList.remove('highlight_select')
    })

}

// CLEAR SELECTED FILES ARRAY
function clear_selected_files() {

    console.log('clearing selected files')

    nc = 1
    nc2 = 0
    adj = 0
    is_folder_card = true

    // clear_highlight_select

    delete_arr = []

    // CLEAR SELECTED FILES ARRAY
    selected_files = []

    // CLEAR COPY_FILES_ARR
    //THIS SHOULD BE CLEARED AFTER COPY NOT HERE
    // copy_files_arr = []

    // PAGER
    let pager = document.getElementById('pager')
    pager.innerHTML = ''


    // QUICK SEARCH
    let txt_search = document.getElementById('txt_search')
    txt_search.value = ''
    txt_search.classList.add('hidden')

    // FIND
    let find_div = document.getElementById('find_div')
    find_div.classList.add('hidden')

    // FIND ADVANCED OPTIONS
    let find_options = document.getElementById('find_options')
    find_options.classList.add('hidden')

    // FIND RESULTS VIEW
    let search_content = document.getElementById('search_content')
    search_content.classList.remove('active')

    // CLEAR TEXT
    // let selected_files_list = document.getElementById('selected_files_list')
    // selected_files_list.innerText = ''


    // body.style.cursor = 'default'
    // console.log('card = ' + card_id)

    let input = document.getElementById('edit_' + card_id)
    if (input) {
        input.classList.add('hidden')
    }

    let header = document.getElementById('header_' + card_id)
    if (header) {
        header.classList.remove('hidden')
    }

    // CLEAR FOLDER CARD
    // let folder_card = document.getElementsByClassName('folder_card')
    // for (var i = 0; i < folder_card.length; i++) {

    //     // let input = document.getElementById('edit_folder_card_' + i)
    //     // input.classList.add('hidden')

    //     folder_card[i].classList.remove('highlight_select')

    //     folder_card[i].querySelector('input').classList.add('hidden')
    //     folder_card[i].querySelector('a').classList.remove('hidden')

    // }


    // // CLEAR FILE CARD
    // let file_card = document.getElementsByClassName('file_card')
    // for (let i = 0; i < file_card.length; i++) {

    //     file_card[i].classList.remove('highlight_select')

    //     file_card[i].querySelector('input').classList.add('hidden')
    //     file_card[i].querySelector('a').classList.remove('hidden')
    // }


    // CLEAR ALL NAV ITEMS
    let nav_items = document.querySelectorAll('.nav_item')
    nav_items.forEach(item => {

        item.classList.remove('highlight_select','ds-selected')
        item.classList.remove('highlight')

        item.querySelector('input').classList.add('hidden')
        item.querySelector('a').classList.remove('hidden')

    })

    // // CLEAR ALL CARDS
    // let cards = document.getElementsByClassName('card')
    // for (let i = 0; i < cards.length; i++) {
    //     let card = cards[i]
    //     card.classList.remove('highlight_select')
    // }


    if (target) {

        let card = document.getElementById(target.id)

        if (card) {

            let header = card.querySelector('a')
            let textarea = card.querySelector('textarea')
            let input = card.querySelector('input')

            //
            if (prev_target) {
                prev_target.classList.remove('highlight_select')
            }

            if (textarea) {
                header.classList.remove('hidden')
                textarea.classList.add('hidden')
            }

            if (input) {
                try {
                    header.classList.remove('hidden')
                    input.classList.add('hidden')
                } catch (err) {

                }

            }

        }

    }

    // notification('items cleared')
    // console.log('clearing selected files')

    // FOCUS MAIN VIEW
    let main_view = document.getElementById('main_view');
    main_view.focus();

    ds.start();

}

// CLEAR COPY CACHE
function clear_copy_arr() {

    if (copy_files_arr.length > 0) {
        notification('Cleared copied items');
        copy_files_arr = []
    }

}

// PRELOAD IMAGES
function preloadImages(array) {
    if (!preloadImages.list) {
        preloadImages.list = []
    }
    var list = preloadImages.list;
    for (var i = 0; i < array.length; i++) {

        var img = new Image();
        img.onload = function () {
            var index = list.indexOf(this);
            if (index !== -1) {
                // remove image from the array once it's loaded
                // for memory consumption reasons
                list.splice(index, 1);
            }
        }
        list.push(img);
        img.src = array[i];

    }
}

// FIND FILES
async function find_files() {

    let filename
    let cmd

    // SEARCH VIEW
    let search_content = document.getElementById('search_content');
    let search_results = document.getElementById('search_results');

    search_results.innerHTML = ''

    let find_div = document.getElementById('find_div')
    let find = document.getElementById('find')
    let find_options = document.getElementById('find_options')
    let btn_find_options = document.getElementById('btn_find_options')
    let breadcrumbs = document.getElementById('breadcrumbs').value
    let find_size = document.getElementById('find_size').value
    let start_date = document.getElementById('start_date').value
    let end_date = document.getElementById('end_date').value

    find_div.classList.remove('hidden')
    find.focus()

    // CANCEL SEARCH
    find.addEventListener('keyup', function (e) {

        // CLEAR ON ESCAPE
        if (e.key === 'Escape') {
            console.log('esc pressed on find')
            clear_selected_files()
        }

        if (e.key === 'Enter') {

            if (find.value > '' || find_size > '' || start_date > '' || end_date > '') {

                search_results.innerHTML = ''
                console.log('running find files')

                // CHECK LOCAL STORAGE
                if (localStorage.getItem('find_folders') == '') {
                    localStorage.setItem('find_folders', 1)
                }

                if (localStorage.getItem('find_files') == '') {
                    localStorage.setItem('find_files', 1)
                }

                let find_folders = localStorage.getItem('find_folders')
                let find_files = localStorage.getItem('find_files')

                let options = {
                    d: find_folders,
                    f: find_files,
                    start_date: start_date,
                    end_date: end_date,
                    size: find_size, //localStorage.getItem('find_by_size'),
                    o: ' -o ',
                    s: find.value
                }

                //  SIZE
                if (find_size != '') {
                    let size_option = document.querySelector('input[name="size_options"]:checked').value
                    options.size = '-size +' + options.size + size_option
                }

                // START DATE
                if (options.start_date != '') {
                    let start_date = ' -newermt "' + options.start_date + '"'
                    options.start_date = start_date
                } else {
                    options.start_date = ''
                }

                // END DATE
                if (options.end_date != '') {
                    let end_date = ' ! -newermt "' + options.end_date + '"'
                    options.end_date = end_date
                } else {
                    options.end_date = ''
                }


                // DIR
                if (options.d != '' && options.s != '') {
                    options.d = ' -type d ' + options.size + ' -iname "' + options.s + '*"'
                } else {
                    options.d = ''
                }
                // FILES
                if (options.f != '' && options.s != '') {
                    options.f = ' -type f ' + options.size + ' -iname "' + options.s + '*"'
                } else {
                    options.f = ''
                }


                // OR
                if (options.d && options.f && options.s != '') {
                    options.o = ' -or '
                } else {
                    options.o = ''
                }

                search_results.innerHTML = 'Searching...'

                //  FIND FILES
                cmd = ' find "' + breadcrumbs + '" ' + options.start_date + options.end_date + options.size + options.d + options.o + options.f
                console.log(cmd)
                let child = exec(cmd)

                child.stdout.on('data', (res) => {

                    res = res.split('\n')
                    if (res.length > 0 && res.length < 500) {

                        search_content.classList.add('active')
                        search_results.innerHTML = ''

                        for (let i = 0; i < res.length; i++) {

                            try {

                                let filename = res[i]

                                // if (fs.statSync(filename).isDirectory() || fs.statSync(filename).isFile()) {

                                    let options = {

                                        id: 'find_' + i,
                                        linktext: path.basename(filename),
                                        href: filename,
                                        grid: search_results,
                                        is_folder: fs.statSync(filename).isDirectory()

                                    }

                                    try {

                                        add_card(options).then(card => {

                                            // search_results.insertBefore(card, search_results.firstChild)
                                            update_cards(search_results)

                                        })

                                    } catch (err) {

                                        notification(err)
                                        info(err)

                                    }

                                // }


                            } catch (err) {
                                notification(err)
                            }

                        }

                    }

                })

                child.stdout.on('end', (res) => {

                    if (search_results.innerHTML == 'Searching...') {
                        search_results.innerHTML = 'No results found......'
                    }

                })

                show_sidebar()

            } else {
                search_content.classList.remove('active')
            }

        }

    })

    // FIND OPTIONS
    btn_find_options.addEventListener('click', (e) => {
        e.preventDefault()
        find_options.classList.remove('hidden')
    })

}

// FUNCTION SIMILAR TO STRING.FORMAT IN C# LAND
String.prototype.format = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

// DARK MODE
contextBridge.exposeInMainWorld('darkMode', {
    toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
    system: () => ipcRenderer.invoke('dark-mode:system')
})

// LISTEN FOR CONTEXTMENU. DO NOT CHANGE THIS - I MEAN IT !!!!!!!!!!!!!!!!!!!!!!!!!
window.addEventListener('contextmenu', function (e) {

    if (active_href) {

        let stats = fs.statSync(active_href);

        if (stats) {

            let filetype = mime.lookup(active_href);
            let associated_apps = get_available_launchers(filetype, active_href);

            // CHECK FOR FOLDER CARD CLASS
            if (stats.isDirectory()) {

                ipcRenderer.send('show-context-menu-directory', associated_apps);

                // CHECK IF FILE CARD
            } else if (stats.isFile()) {

                ipcRenderer.send('show-context-menu-files', associated_apps);

            // EMPTY AREA
            // todo this needs to be looked
            } else {

                ipcRenderer.send('show-context-menu');

            }

            active_href = '';

        }

    } else {

        let data = {
            source: path.join(__dirname, 'assets/templates/'),
            destination: breadcrumbs.value + '/'
        }

        ipcRenderer.send('show-context-menu', data);

        // // ON COPY COMPLETE
        // ipcRenderer.on('copy-complete', function (e) {
        //     get_files(breadcrumbs.value, { sort: localStorage.getItem('sort') })
        // })

    }

})

// FUNCTIONS //////////////////////////////////////////////////////

// LAZY LOAD IMAGES
// add a class of lazy, a data.src with real image path and set src=path to generic file
function lazyload() {

    // LAZY LOAD IMAGES
    let lazyImages = [].slice.call(document.querySelectorAll("img.lazy"))

    console.log('lazy images count ', lazyImages.length);

    // CHECK IF WINDOW
    if ("IntersectionObserver" in window) {

        console.log('running intersection observer')

        // GET REFERENCE TO LAZY IMAGE
        let lazyImageObserver = new IntersectionObserver(function (entries, observer) {

            // if (entries.length > 1) {

            entries.forEach(function (entry) {

                if (entry.isIntersecting) {

                    let lazyImage = entry.target;
                    lazyImage.src = lazyImage.dataset.src;
                    // lazyImage.srcset = lazyImage.dataset.src;
                    lazyImage.classList.remove("lazy");
                    lazyImageObserver.unobserve(lazyImage);

                }

            })

            // }

        })

        // THIS RUNS ON INITIAL LOAD
        lazyImages.forEach(function (lazyImage) {
            lazyImageObserver.observe(lazyImage)
        })

    } else {

    }
}

// HIDE PROGRESS
function hide_progress(card_id) {

    let progress = document.getElementsByClassName('progress')
    if (progress) {
        for (let i = 0; i < progress.length; i++) {
            progress[i].classList.add('hidden')
        }
    }
}

// ANOTHER GET ALL FILES
const get_files_recursive = function (source) {

    // files = fs.readdir(dirPath, (err, files)){

    files_arr = []
    fs.readdir(source, (err, files) => {
        if (err)
            console.log(err);
        else {
            console.log("\nCurrent directory filenames:");
            files.forEach(file => {

                if (fs.statSync(source).isDirectory()) {
                    files_arr = get_files_recursive(source)
                } else {
                    files_arr.push(file)
                }

                console.log(file);
            })
        }
    })

}

// PASTE
function paste() {

    state = 2

    // RUN MOVE TO FOLDER
    if (cut_files == 1) {
        cut_files = 0;
        move_to_folder(breadcrumbs.value, state);

    // RUN COPY FUNCTION
    } else {
        copy_files(breadcrumbs.value, state);
    }

    // CLEAN UP
    clear_selected_files();

}

// ADD GRID
function add_grid() {
    let grid = document.createElement('div')
    grid.classList.add('ui', 'grid')
    return grid
}

// ADD DIV
function add_div() {
    let div = document.createElement('div')
    return div
}

// ADD ROW
function add_row() {
    let row = document.createElement('div')
    row.classList.add('row')
    row.style = 'width: 100%; padding: 0px !important;';
    return row
}

// ADD DRAGHANDLE
function add_draghandle() {

    let draghandle = add_div()
    draghandle.style = 'width: 4px; height:100%; position:absolute; right: 0; background-color: #2c2c2c';

    draghandle.addEventListener('mouseover', (e) => {

        console.log('mouse over')
        draghandle.style.cursor = 'col-resize';

    })

    draghandle.addEventListener('mouseout', (e) => {
        console.log('mouse out');
    })

    return draghandle;
}

// ADD COLUNN
function add_column(length) {

    // CREATE OOLUMN
    let column = add_div()
    column.style = 'float:left; width:25%; margin-left: 5px; padding: 5px; border-bottom: 1px solid #000; border-right: 1px solid #000'
    column.classList.add('column', length, 'wide')


    // ADD DRAG HANDLE
    column.append(add_draghandle())
    return column
}

// ADD BREAK
function add_br() {
    return document.createElement('br')
}

// ADD ITEM
function add_item(text) {
    let item = document.createElement('div')
    item.classList.add('item')
    item.innerHTML = text
    return item
}

// ADD BUTTON
function add_button(id, text) {
    let button = document.createElement('input')
    button.type = 'button'
    button.classList.add('ui', 'button', 'default')
    button.value = text
    return button
}

// ADD CHECKBOX
function add_checkbox(id, label) {

    let checkbox = add_div()
    checkbox.classList.add('ui', 'checkbox')

    let chk_label = add_label(label)
    chk_label.htmlFor = id

    let chk = document.createElement('input')
    chk.type = "checkbox"
    chk.id = id

    checkbox.append(chk)
    checkbox.append(chk_label)

    return checkbox

}

// ADD LABEL
function add_label(text) {
    let label = document.createElement('label')
    label.innerHTML = text
    return label
}

// ADD PROGRESS
function add_progress() {
    let progress = document.createElement('progress')
    progress.value = 1
    progress.max = 100
    return progress
}

// ADD IMG
function add_img(src) {
    let img = document.createElement('img')
    img.style = 'float:left; padding-right: 5px; vertical-align: middle !important'
    img.width = 32
    img.height = 32
    img.classList.add('lazy')
    img.dataset.src = src
    img.src = img.src = path.join(icon_dir, '/actions/scalable/image-x-generic-symbolic.svg')
    return img
}

// RETURNS A STRING PATH TO AN ICON IMAGE BASED ON FILE EXTENSION
let icon_theme = execSync('gsettings get org.gnome.desktop.interface icon-theme').toString().replace(/'/g, '').trim()
let icon_dir = path.join('/usr/share/icons', icon_theme)

let folder_icon_dir = path.join('/usr/share/icons', icon_theme)
console.log(icon_dir,fs.existsSync(icon_dir))

if (fs.existsSync(icon_dir) == false) {
    console.log(icon_dir)
    icon_dir = path.join(path.join(get_home(), '.icons'), icon_theme)
} else {

}

// IF ICONS ARE NOT IN PATH THEN TRY ICONS IN .icons
if (!fs.existsSync(folder_icon_dir)) {
    folder_icon_dir = path.join(get_home(), '.icons', icon_theme)
    console.log('folder_icons', folder_icon_dir)
}

// GET FOLDER_ICON
function get_folder_icon(callback) {

    let theme = readline.createInterface({
        input: fs.createReadStream(path.join(folder_icon_dir, 'index.theme'))
    });

    let places = '';
    theme.on('line', (line) => {
        if (line.indexOf('Directories') === -1 && line.indexOf('symbolic') === -1 && line.indexOf('scalable') === -1 && line.indexOf('places') > -1) {

            places = line.replace('[', '').replace(']', '');

            let folder = ['folder.svg', 'folder.png'];
            folder.every(file => {

                icon = path.join(folder_icon_dir, places, file);
                // console.log('places', icon);

                if (!fs.existsSync(icon)) {
                    icon = path.join(__dirname,'/assets/icons/folder.png');
                    return true;
                } else {
                    return false;
                }

            });

            // console.log('search folder', icon);
            callback(icon);

            return false;

        }
    })

}

function get_icon_path(file) {

    // console.log('get icon path', file)

    try {

        let stats = fs.statSync(file)
        let file_ext = path.extname(file)

        if (stats.isDirectory()) {

            // todo: this needs to be reworked to get theme folder icon
            icon = path.join(__dirname,'/assets/icons/folder.png');

        } else {

            icon_dir = path.join(__dirname,'/assets/icons/korla')
            if (file_ext.toLocaleLowerCase() == '.jpg' || file_ext.toLocaleLowerCase() == '.png' || file_ext.toLocaleLowerCase() == '.jpeg' || file_ext.toLocaleLowerCase() == '.gif' || file_ext.toLocaleLowerCase() == '.svg' || file_ext.toLocaleLowerCase() == '.ico' || file_ext.toLocaleLowerCase() == '.webp') {
                icon = file
                let img_data = get_img_data(file);
                console.log(img_data)
            } else if (file_ext == '.xls' || file_ext == '.xlsx' || file_ext == '.xltx' || file_ext == '.csv') {
                icon = path.join(icon_dir,'/apps/scalable/ms-excel.svg') //../assets/icons/korla/apps/scalable/libreoffice-calc.svg'
            } else if (file_ext == '.docx' || file_ext == '.ott' || file_ext == '.odt') {
                icon = path.join(icon_dir,'/apps/scalable/libreoffice-writer.svg')
            } else if (file_ext == '.wav' || file_ext == '.mp3' || file_ext == '.mp4' || file_ext == '.ogg') {
                icon = path.join(icon_dir,'/mimetypes/scalable/audio-wav.svg')
            } else if (file_ext == '.iso') {
                icon = path.join(icon_dir,'/apps/scalable/isomaster.svg')
            } else if (file_ext == '.pdf') {
                icon = path.join(icon_dir,'/apps/scalable/gnome-pdf.svg')
            } else if (file_ext == '.zip' || file_ext == '.xz' || file_ext == '.tar' || file_ext == '.gz' || file_ext == '.bz2') {
                icon = path.join(icon_dir,'/apps/scalable/7zip.svg')
            } else if (file_ext == '.deb') {
                icon = path.join(icon_dir, '/apps/scalable/gkdebconf.svg')
            } else if (file_ext == '.txt') {
                icon = path.join(icon_dir,'/apps/scalable/text.svg')
            } else if (file_ext == '.sh') {
                icon = path.join(icon_dir,'/apps/scalable/terminal.svg')
            } else if (file_ext == '.js') {
                icon = path.join(icon_dir,'/apps/scalable/applications-java.svg')
            } else if (file_ext == '.sql') {
                icon = path.join(icon_dir,'/mimetypes/scalable/application-x-sqlite.svg')
            } else {
                icon = path.join(icon_dir,'/mimetypes/scalable/application-document.svg')
            }

        }


    } catch (err) {
        // icon = path.join(icon_dir,'/mimetypes/scalable/application-document.svg')
    }



    return icon

}

// ADD LINK
function add_link(href, text) {
    let link = document.createElement('a')
    link.href = href
    link.text = text
    link.classList.add('header_link')
    return link
}

// ADD ICON
function add_icon(icon_name) {
    let icon = document.createElement('i')
    icon.classList.add('ui', 'icon', icon_name)
    return icon
}

// ADD ICON
function add_p(text) {
    let p = document.createElement('p')
    p.innerHTML = text
    return p
}

// ADD HEADER
function add_header(text) {
    let header = document.createElement('h4');
    // header.style = 'font-weight:bold; font-size: 14px; padding: 5px; position: fixed;';
    header.innerHTML = text;
    return header;
}

function logKey(e) {
    console.log(e.code);
}

// RENDER FILES
function get_folder_files(dir, options) {

    // // CLEAR SELECTED FILES ARRAY
    // selected_files.length = 0
    // console.log('clearing array')

    // REF TO DOM ELEMENTS ON PAGE
    let files_card = document.getElementById('files_card')
    let file_grid = document.getElementById('file_grid')
    let file_grid_hidden = document.getElementById('file_grid_hidden')

    file_grid.innerHTML = ''
    file_grid_hidden.innerHTML = ''

    // CREATE GRID
    let grid = add_div()
    grid.classList.add('ui', 'grid')

    // CREATE COLUMN
    let column = add_div()
    column.classList.add('column', 'sixteen', 'wide')

    // ADD COLUMN TO GRID
    grid.appendChild(column)

    // CREATE SECOND GRID
    let grid1 = add_div()
    grid1.classList.add('ui', 'grid')

    let size = 0
    let prev_size = 0

    get_files(dir, options, function ({ files }) {


        // FILES FILTER
        let filter = files.filter(file => !file.is_dir)
        // console.log('files ' + files.is_dir + ' length ' + filter.length)

        // HIDE FILES CARD IF NO FILES FOUND
        files_card.classList.remove('hidden')
        if (filter.length == 0) {
            // console.log('adding hidden to files_card')
            files_card.classList.add('hidden')
        }

        // FILTER EXTENSION
        let exts = Array.from(new Set(filter.map(ext => ext.extension)))

        // LOOP OVER EXTENSION
        exts.forEach((ext, idx) => {

            // CREATE HEADER LABEL
            let label = document.createElement('h5')
            // label.setAttribute('draggable',true)
            label.innerText = ext

            // CREATE HEADER COLUMN
            let header_col = add_div()
            header_col.classList.add('column', 'sixteen', 'wide')
            header_col.appendChild(label)

            // ADD HEADER COLUMN TO GRID 1
            grid1.appendChild(header_col)

            // ADD GRID 1 TO FILE GRID
            file_grid.appendChild(grid1)

            // ADD SECOND FILTER HERE
            let filter1 = []
            filter1 = filter.filter(file_ext => file_ext.extension == ext)

            // LOOP OVER EACH FILE IN FILES
            // filter1.forEach((file,idx1) => {
            for (let i = 0; i < filter1.length; i++) {

                let options = new item_options()

                // CREATE COLUMN 1
                let column1 = add_div()
                column1.classList.add('column', 'three', 'wide')

                // CREATE OPTIONS FOR ITEM
                options.id = 'file_card_' + idx + i

                options.href = filter[i].dir

                options.linktext = filter[i].name
                options.image = get_icon_path(filter[i].dir)
                options.description = filter[i].mtime
                options.is_directory = filter[i].is_dir

                // ADD FILE CARD
                let file_card = add_card(options, i)
                console.log('adding file card')

                // ADD FILE STATS !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                // prev_size = size
                // size = prev_size + filter[i].size

                // ADD CARD 1 TO COLUMN 1
                column1.appendChild(file_card)

                // ADD COLUMN1 TO GRID 1
                grid1.appendChild(column1)

            }

            // REMOVE HIIDEN FROM FILE GRID
            file_grid.classList.remove('hidden')

        })

    })

    grid.appendChild(grid1)

    // ADD GRID TO FILE GRID
    file_grid.appendChild(grid1)

    // console.log('removing')

}



// ADD HEADER MENU ITEM
function add_menu_item(options) {

    let item = document.createElement('a')
    item.classList.add('item')
    item.id = options.id

    let icon = document.createElement('i')
    icon.classList.add(options.icon, 'icon')

    let content = document.createElement('div')
    content.innerText = "shit"

    item.appendChild(icon)
    item.appendChild(content)

    const header_menu = document.getElementById('header_menu')
    header_menu.appendChild(item)

}


// SHOW SIDE BAR
let sidebar_visible = 0
function show_sidebar() {

    // SHOW / HIDE SIDEBAR
    let sidebar = document.getElementById('sidebar')
    let main_view = document.getElementById('main_view')

    sidebar.draggable = false
    sidebar.classList.remove('hidden')
    let sidebar_width = 250
    if (localStorage.getItem('sidebar_width')) {
        sidebar_width = localStorage.getItem('sidebar_width')
    } else[
        localStorage.setItem('sidebar_width', sidebar_width)
    ]

    sidebar.style.width = sidebar_width + 'px'
    main_view.style.marginLeft = (parseInt(sidebar_width) + 10) + 'px'

    // let accordion = document.getElementById('accordion')
    // accordion.focus()
    sidebar_visible = 1

}

// // HIDE SIDE BAR
function hide_sidebar() {

    // SHOW / HIDE SIDEBAR
    let sidebar = document.getElementById('sidebar')
    let main_view = document.getElementById('main_view')

    sidebar.style.width = "0";
    sidebar.classList.add('hidden')

    main_view.style.marginLeft = "5px";

    sidebar_visible = 0

}

// NOTIFICATION
window.notification = function notification(msg) {

    let notification = document.getElementById('notification')
    notification.innerHTML = msg
    notification.classList.remove('hidden')
    setInterval(() => {
        notification.classList.add('hidden')
    }, 3000);
}


// CREATE FOLDER
function create_folder(folder) {

    fs.mkdir(folder, {}, (err) => {

        console.log('folder is ' + folder)

        if (err) {

            notification(err)
            alert(err)

        } else {

            // GET REFERENCE TO FOLDERS CARD
            let folders_card = document.getElementById('folders_card')
            folders_card.classList.remove('hidden')

            // GET REFERENCE TO FOLDER GRID
            let folder_grid = document.getElementById('folder_grid')

            let items = document.getElementsByClassName('folder_card')
            let card_id = 'folder_card_' + items.length

            // CREATE CARD OPTIONS
            let options = {

                id: card_id,
                href: folder,
                linktext: path.basename(folder),
                grid: folder_grid

            }

            try {

                add_card(options).then(card => {

                    folder_grid.insertBefore(card, folder_grid.firstChild)

                    let header = document.getElementById('header_' + card_id)
                    header.classList.add('hidden')

                    let input = card.querySelector('input')
                    input.classList.remove('hidden')

                    //
                    input.focus()
                    input.select()

                    update_cards(folder_grid)

                })

            } catch (err) {

                notification(err)
                info(err)

            }

            // // ADD CARD
            // let card = add_card(options)
            // // column.appendChild(card)
            // folder_grid.insertBefore(card, folder_grid.firstChild)

            // INPUT
            // let input = card.getElementsByTagName('input')
            // input[0].classList.remove('hidden')
            // input[0].focus()
            // input[0].select()

            // console.log(card_id)

            // let header = document.getElementById('header_' + card_id)
            // header.classList.add('hidden')

            console.log('Created ' + path.dirname(folder));

        }

    })

    clear_selected_files()

}

// RENAME FOLDER
function rename_folder(directory, new_directory) {

    fs.rename(directory, new_directory, function (err) {
        if (err) {
            notification(err)
            console.log(err)
        } else {
            notification('Folder renamed successfully')
            console.log('Folder renamed successfully!');
        }
    })


}

// COPY FILES
async function copy_files(destination_folder, state) {

    let info_view = document.getElementById('info_view');
    info_view.innerHTML = '';

    console.log('destination', destination,'state', state);
    console.log('copy files array length', copy_files_arr.length);

    // RESET COUNTER. HANDLES SETTING ROOT FOLDER SO THE SIZE CAN BE UPDATED
    // copy_folder_counter = 0

    // ADD DESTINATION TO COPY FILES ARRAY
    copy_files_arr.forEach((item, idx) => {
        item.destination = destination_folder;
    })

    ipcRenderer.send('copy', copy_files_arr, state);
    clear_copy_arr();

}


// todo: need to figure out when this is done

// COPY FILE SYNC
let number_of_files = 0
let recursive = 0

// COPY FILE
function copyFileSync(source, target) {

    console.log('copy file sync preload')

    var targetFile = target
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    recursive++

    // HANDLE PROGRESS
    let progress = document.getElementById('progress')
    progress.classList.remove('hidden')

    let source_stats = fs.statSync(source)
    let intervalid = setTimeout(() => {

        try {

            let destination_stats = fs.statSync(target)
            progress.value = destination_stats.size

            if (destination_stats.size >= source_stats.size) {
                hide_top_progress()
                clearInterval(intervalid)
            }

        } catch (err) {

        }



    }, 100);

    // COPY FILE
    fs.copyFile(source, targetFile, (err) => {

        if (err) {

            console.log(err)

        } else {

            if (--recursive == 0) {

                // CLEAR PROGRESS
                hide_top_progress()
                c = 0

                // UPDATE CARDS
                let main_view = document.getElementById('main_view')
                update_cards(main_view)

                notification('done copying folder files to ' + target)

            } else {

                notification('copying folder files to ' + targetFile)
            }
            // console.log('copied file from ' + source + ' to ' + targetFile)
        }
    })
}

// COPY FOLDER
let root = ''
let copy_folder_counter = 0
let destination0 = ''
function copyFolderRecursiveSync(source, destination) {

    console.log('folder_count ' + folder_count)
    copy_folder_counter += 1

    // COPY
    // READ SOURCE DIRECTORY
    fs.readdir(source, function (err, files) {

        if (err) {
            console.log(err)
        } else {

            // CHECK LENGTH
            if (files.length > 0) {

                if (!fs.existsSync(destination)) {
                    destination0 = destination
                    fs.mkdirSync(destination)
                } else {
                    fs.mkdirSync(destination + ' Copy')
                }

                // LOOP OVER FILES
                files.forEach((file, idx) => {

                    // GET FOLDER SIZE WORKS HERE KIND OF!!!. RUNS TOO MANY TIMES.
                    // todo: need to figure out how to handle this better

                    // GET CURRENT SOURCE / CURRENT DESTINATION
                    let cursource = path.join(source, file)
                    let curdestination = path.join(destination, file)

                    // GET STATS OF CURRENT SOURCE
                    fs.stat(cursource, (err, stats) => {

                        if (err) {
                            console.log(err)
                        } else {

                            // DIRECTORY
                            if (stats.isDirectory() == true) {

                                // alert('curdest ' + curdestination)
                                copyFolderRecursiveSync(cursource, curdestination)

                                console.log('running copyfoldersync')
                                console.log('running copyfoldersync', 'cursource ', cursource, 'curdestination', curdestination)
                                // UPDATE FOLDER_SIZE
                                // ipcRenderer.send('get_folder_size', { href: destination })


                            // FILE
                            } else if (stats.isFile() == true) {

                                // debugger
                                copyFileSync(cursource, curdestination)
                                console.log('running copyfilesync', cursource, curdestination)

                            }

                            // DONT GET DISK SPACE HERE

                        }

                    })


                })

            }

        }

    })

}

// MOVE FOLDER
function move_to_folder(destination, state) {

    // ADD DESTINATION TO ARRAY
    copy_files_arr.forEach((item,idx) => {
        item.destination = destination
    })

    // SEND TO MAIN
    ipcRenderer.send('move', copy_files_arr, state)

    clear_copy_arr()

}

// CREATE FILE FROM TEMPLATE
function create_file_from_template(filename) {

    let main_view = document.getElementById('main_view')

    let template = path.join(__dirname, 'assets/templates/', filename)
    let destination = path.join(breadcrumbs.value, filename)

    console.log('running create file ' + template + ' destin ' + destination)
    console.log(breadcrumbs.value)

    if (fs.existsSync(destination) == true) {
        alert('this file already exists')
    } else {

        fs.copyFileSync(template, destination)
        console.log('done')

        if (fs.existsSync(destination) == true) {

            watch_count = 1

            // GET REFERENCE TO FOLDERS CARD
            let files_card = document.getElementById('files_card')
            files_card.classList.remove('hidden')

            // let file_grid = document.getElementById('file_grid')
            let card_id = 'file_card_1001'

            // CREATE CARD OPTIONS
            let options = {

                id: card_id,
                href: destination,
                linktext: path.basename(destination),
                grid: file_grid

            }

            try {

                add_card(options).then(card => {

                    let files_card = document.getElementById('files_card')
                    files_card.classList.remove('hidden')

                    let file_grid = document.getElementById('file_grid')
                    file_grid.insertBefore(card, file_grid.firstChild)


                    let input = card.getElementsByTagName('input')
                    input[0].classList.remove('hidden')
                    input[0].focus()
                    // input[0].select()
                    input[0].setSelectionRange(0, input[0].value.length - path.extname(filename).length)

                    console.log(card_id)

                    let header = document.getElementById('header_' + card_id)
                    header.classList.add('hidden')



                    // update_parent()

                    update_cards(main_view)

                })

            } catch (err) {

                notification(err)

            }

        }

    }

    clear_selected_files()

}

// // CREATE FILE FROM TEMPLATE
// ipcRenderer.on('create_file_from_template', function (e, file) {
//     console.log('im running too many times')
//     create_file_from_template(file.file)

// })


// RENAME FILE OR FOLDER
function rename_file(source, destination_name) {

    if (destination_name == "") {

        alert('Enter a file name');

    } else {

        let filename = path.join(path.dirname(source), destination_name)
        console.log('renaming', source, filename)

        let exists = fs.existsSync(filename)

        if (exists) {

            // todo: this is not working correctly
            alert(filename + ' already exists!')
            return false

        } else {

            console.log(source, filename)
            fs.rename(source, filename, function (err) {

                if (err) {

                    console.log(err)

                } else {

                    console.log('File/folder renamed successfully!');
                    notification('Renamed ' + path.basename(source) + ' to ' + destination_name);

                    // let main_view = document.getElementById('main_view')
                    // update_cards(main_view)

                    // update_card(filename)

                }

            })
        }

    }

}

// DELETE CONFIRMED
delete_files_count = 0
delete_folder_count = 0
function delete_confirmed() {

    // LOOP OVER ITEMS DELETE ARRAY
    if (delete_arr.length > 0) {

        delete_arr.forEach((file, idx) => {

            card_id = file.card_id
            console.log('file source ' + file.source + ' card_id ' + file.card_id)

            // CLEAR HREF LOCAL STORAGE
            // console.log('href ' + file.source)
            // localStorage.setItem(file.source, '')

            // IF DIRECTORY
            if (fs.statSync(file.source).isDirectory()) {

                ++delete_folder_count
                console.log('running delete folder ' + file.source + ' card_id ' + file.card_id)

                console.log('size', localStorage.getItem(file.source))

                // RUN PROGRESS
                get_progress(parseInt(localStorage.getItem(file.source) * -1))

                // DELETE FOLDER
                delete_folder(file.source)

                // notification(delete_folder_count + ' folders deleted.')

            // IF FILE
            } else if (fs.statSync(file.source).isFile()) {

                ++delete_files_count
                console.log('running delete file ' + file.source + ' card_id ' + file.card_id)

                // DELETE FILE
                delete_file(file.source)

                // notification(delete_files_count + ' files deleted.')

            }

            // // REMOVE CARD
            // let card = document.getElementById(file.card_id)
            // let col = card.closest('.column')
            // col.remove()

            // // UPDATE CARDS
            // update_cards(main_view)

        })

        let msg = ""
        if (delete_folder_count > 0) {
            msg = delete_folder_count + ' folder/s deleted.'
        }
        if (delete_files_count > 0) {
            msg = msg + ' ' + delete_files_count + ' file/s deleted'
        }
        notification(msg)


        // ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: 0,file_count: 0 })

        // CLEAR DELETE ARRAY
        delete_arr = []
        clear_selected_files()


        // UPDATE CARDS
        update_cards(main_view)



    } else {
        console.log('nothing to delete')
        // indexOf('Nothing to delete.')
    }

}

// DELETE FILE
async function delete_file(file) {

    console.log('deleting file ' + file)
    notification('deleting file ' + file)

    let main_view = document.getElementById('main_view')

    let stats = fs.statSync(file)

    if (stats) {

        if (stats.isFile()) {

            fs.unlink(file, function (err) {

                if (err) {

                    clear_selected_files()

                    notification('Error deleting file: ' + source + ' \n' + err)
                    console.log('Error deleting file: ' + source + ' \n' + err)

                } else {

                    // folder_count = delete_arr.filter(item => fs.statSync(item.source).isDirectory().length)
                    // file_count = delete_arr.filter(item => fs.statSync(item.source).isFile().length)

                    // notification (get_file_count() + ' Files deleted.')
                    // notification('deleted file ' + file)
                    // ipcRenderer.send('get_folder_size', { href: breadcrumbs.value })

                    // HIDE PROGRESS
                    // hide_top_progress()

                    let card = document.querySelector('[data-href="' + file + '"]')
                    let col = card.closest('.column')
                    col.remove()

                    // UDATE CARDS
                    update_cards(main_view)

                }

            })


        } else {

            notification('error deleted file ' + source)
            console.log('Error deleting file: ' + source)
        }

    }

}

// DELETE FOLDER
function delete_folder(directory) {

    // let breadcrumbs = document.getElementById('breadcrumbs')
    notification('running delete foder')
    console.log('direcotry = ' + path.basename(directory))

    // CHECK IF YOU ARE ABOUT TO WACK IMPORTANT FOLDER
    if (breadcrumbs.value == 'Documents' || breadcrumbs.value == 'Home' || breadcrumbs.value == 'Downloads' || breadcrumbs.value == 'Pictures' || breadcrumbs.value == 'Music') {

        alert('This is a system Directory. Do not delete!')
        return 0

    } else {

        // CHECK IF ITS A DIRECTORY
        if (fs.statSync(directory).isDirectory()) {

            // DELETE FOLDER
            fs.rm(directory, { recursive: true }, (err) => {

                if (err) {

                    notification(err)
                    console.error(err)

                } else {

                    // COUNT ITEMS IN MAIN VIEW
                    folder_count = get_folder_count()
                    file_count = get_file_count()

                    let card = document.querySelector('[data-href="' + directory + '"]')
                    let col = card.closest('.column')
                    col.remove()

                    // update_cards(main_view)

                    // hide_progress(card_id)
                    // notification('Deleted directory ' + directory)
                    ipcRenderer.send('get_disk_space', { href: breadcrumbs.value, folder_count: folder_count, file_count: file_count })

                }

            })

        } else {

            notification('Error: This is not directory!')
            console.log('Error: This is not directory!')

        }

    }

}

// GET FOLDER COUNT
function get_folder_count() {
    let main_view = document.getElementById('main_view')
    let folder_cards = main_view.querySelectorAll('.folder_card')
    return folder_cards.length
}

// GET FILE COUNT
function get_file_count() {
    let main_view = document.getElementById('main_view')
    let file_cards = main_view.querySelectorAll('.file_card')
    return file_cards.length
}

// CALCULATE FILE SIZE
function get_file_size(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];

};

// GET RAW FILE SIZE
function get_raw_file_size(fileSizeInBytes) {
    var i = -1;
    // var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1);

};


// OPEN TERMINAL
function get_terminal() {

    exec('gnome-terminal --working-directory=' + breadcrumbs.value, (error, data, getter) => {

    });

}
// COUNTERS
let click_counter = 0
let history_arr_size = 0
let idx = 0

// SET FALG FOR HISTORY MANAGEMENT
let is_navigate = false;

// NAVIGATE FUNCTION LEFT RIGHT UP
function navigate(direction) {

    is_navigate = true;
    let dir = get_home();

    let breadcrumbs = document.getElementById('breadcrumbs');
    let last_index = history_arr.lastIndexOf(breadcrumbs.value);

    console.log('array',history_arr,'last index', last_index)

    for(i = 0; i < history_arr.length; i++) {

        if (history_arr[i] == breadcrumbs.value) {

            // NAVIGATE LEFT
            if (direction == 'left') {
                console.log('navigating left', history_arr);
                if (i > 1) {
                    dir = history_arr[last_index - 1];
                } else {
                    dir = breadcrumbs.value.substring(0, breadcrumbs.value.length - path.basename(breadcrumbs.value).length - 1)
                }
            }

            // NAVIGATE RIGHT
            if (direction == 'right') {

                if (i < history_arr.length - 1) {
                    dir = history_arr[last_index + 1];
                }
            }

        }

    };

    console.log('navigate path', dir);

    // LOAD VIEW
    get_view(dir);

}

// UPDATE CARD
function update_card(href) {

    let card = document.querySelector('[data-href="' + href + '"]')
    // let header = card.querySelector('.header_link')

    console.log(card)

    let img = card.querySelector('.image')

    // DETAILS
    let extra = card.querySelector('.extra')
    let description = card.querySelector('.description')

    // ADD DATA TO CARD
    let stats = fs.statSync(href)
    let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)

    description.innerHTML = mtime

    // HANDLE DIRECTORY
    if (stats.isDirectory()) {

        img.src = path.join(icon_dir, '-pgrey/places/scalable@2/network-server.svg')
        img.height = '24px'
        img.width = '24px'

        // get_folder_size1(href, size => {
        //     extra.innerHTML = get_file_size(size)
        //     localStorage.setItem(href, size)
        // })

        // CARD ON MOUSE OVER
        card.addEventListener('mouseover', (e) => {
            size = get_file_size(localStorage.getItem(href))
            card.title =
                href +
                '\n' +
                size +
                '\n' +
                mtime
        })

    // FILES
    } else {

        size = get_file_size(stats.size)
        extra.innerHTML = size
        localStorage.setItem(href, stats.size)

        // CARD ON MOUSE OVER
        card.addEventListener('mouseover', (e) => {
            size = get_file_size(localStorage.getItem(href))
            card.title =
                href +
                '\n' +
                size +
                '\n' +
                mtime
        })
    }
}

// function update_card(card) {

//     let href = card.querySelector('.header_link').getAttribute('href')
//     let extra = card.querySelector('.extra')
//     let description = card.querySelector('.description')

//     console.log(href)

//     let stats = fs.statSync(href)

//     let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)

//     description.innerHTML = mtime

// }


// UPDATE CARDS WITH
function update_cards(view) {

    console.log('running update cards')

    try {

        let cards = view.querySelectorAll('.nav_item')
        let cards_arr = []

        for (var i = 0; i < cards.length; i++) {
            cards_arr.push(cards[i]);
        }

        console.log('card length', cards.length)

        let size = ''
        let folder_counter = 0
        let file_counter = 0
        cards_arr.forEach((card, idx) => {

            // console.log(card)

            // DRAG AMD DROP
            ds.addSelectables(card, false)

            ds.subscribe('predragstart', ({ isDragging, isDraggingKeyboard }) => {

                console.log('dragging', isDragging, isDraggingKeyboard)

                if(isDragging) {
                    ds.stop(false,true)
                    // setTimeout(ds.start)
                }
            })

            let header = card.querySelector('.header_link')
            let img = card.querySelector('.image')

            // PROGRESS
            let progress = card.querySelector('.progress')
            let progress_bar = progress.querySelector('progress')

            // DETAILS
            let extra = card.querySelector('.extra')
            let description = card.querySelector('.description')

            let href = card.dataset.href

            // ADD DATA TO CARD
            let stats = fs.statSync(href)
            let mtime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(stats.mtime)

            // card.tabIndex = idx
            card.dataset.id = idx + 1

            description.innerHTML = mtime

            // HANDLE DIRECTORY
            if (stats.isDirectory()) {

                ++folder_counter

                card.id = 'folder_card_' + folder_counter
                // card.dataset.id = folder_counter + 1
                // card.tabIndex = folder_counter
                header.id = 'header_folder_card_' + folder_counter

                card.classList.add('folder_card')

                img.src = path.join(icon_dir, '-pgrey/places/scalable@2/network-server.svg')
                img.height = '24px'
                img.width = '24px'

                ipcRenderer.send('get_folder_size', { href: href })
                // extra.innerHTML = get_file_size(localStorage.getItem(href))

                // CARD ON MOUSE OVER
                card.addEventListener('mouseover', (e) => {
                    size = get_file_size(localStorage.getItem(href))
                    card.title =
                        href +
                        '\n' +
                        size +
                        '\n' +
                        mtime
                })

            // FILES
            } else {

                ++file_counter

                card.id = 'file_card_' + file_counter
                // card.dataset.id = file_counter + 1
                // card.tabIndex = file_counter
                header.id = 'header_file_card_' + file_counter

                progress.id = 'progress_' + card.id
                progress_bar.id = 'progress_bar_' + card.id

                card.classList.add('file_card')

                size = get_file_size(stats.size)
                extra.innerHTML = size
                localStorage.setItem(href, stats.size)

                // CARD ON MOUSE OVER
                card.addEventListener('mouseover', (e) => {
                    size = get_file_size(localStorage.getItem(href))
                    card.title =
                        href +
                        '\n' +
                        size +
                        '\n' +
                        mtime
                })

            }

        })

    } catch (err) {
        // console.log(err)
    }

    file_count = 0
    folder_count = 0

}

// EXTRACT HERE
function extract(source) {

    notification('extracting ' + source)
    console.log('to dest ' + breadcrumbs.value)

    let cmd = ''
    let us_cmd = ''
    let filename = ''

    let ext = path.extname(source).toLowerCase()

    switch (ext) {
        case '.zip':
            filename = source.replace('.zip', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = "unzip '" + source + "' -d '" + filename + "'"
            break;
        case '.tar':
            filename = source.replace('.tar', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '"'
            break;
        case '.gz':
            filename = source.replace('.tar.gz', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xzf "' + source + '" -C "' + filename + '"'
            break;
        case '.xz':
            filename = source.replace('tar.xz', '')
            filename = filename.replace('.img.xz', '')
            us_cmd = "xz -l '" + source + "' | awk 'FNR==2{print $5}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/tar --strip-components=1 -xf "' + source + '" -C "' + filename + '"'
            break;
        case '.bz2':
            filename = source.replace('.bz2', '')
            us_cmd = "gzip -Nl '" + source + "' | awk 'FNR==2{print $2}'"
            cmd = 'cd "' + breadcrumbs.value + '"; /usr/bin/bzip2 -dk "' + source + '"'
            break;

    }

    console.log('cmd ' + cmd)
    console.log('uncompressed size cmd ' + us_cmd)


    // CREATE DIRECTORY FOR COMPRESSED FILES
    if (fs.existsSync(filename)) {

        data = {
            source:source,
            destination: filename
        }

        // ipcRenderer.send('confirm_overwrite', data)

        let confirm_overwrite = confirm(filename, 'exists.\nWould you like to overwrite?\n')
        if (confirm_overwrite) {
            alert('overwrite confirmed')
        }


    } else {
        fs.mkdirSync(filename)
    }


    // GET UNCOMPRESSED SIZE
    let uncompressed_size = parseInt(execSync(us_cmd))

    // RUN PROGRESS
    get_progress(get_raw_file_size(uncompressed_size))

    notification('executing ' + cmd)
    notification('source ' + source)
    console.log('executing ' + cmd)

    // THIS NEEDS WORK. CHECK IF DIRECTORY EXIST. NEED OPTION TO OVERWRITE
    exec(cmd, (err, stdout, stderr) => {

        if (err) {

            console.log('error ' + err)
            notification('error ' + err)

        } else {

            try {

                // GET REFERENCE TO FOLDER GRID
                let folder_grid = document.getElementById('folder_grid');
                let is_folder = fs.statSync(filename).isDirectory();

                // CREATE CARD OPTIONS
                let options = {
                    id: 'folder_card_10000',
                    href: filename,
                    linktext: path.basename(filename),
                    grid: folder_grid
                }

                //
                // let folder_grid = document.getElementById('folder_grid')
                notification('filename ' + filename);

                add_card(options).then(col => {

                    console.log(col);

                    // console.log('card ' + card)
                    folder_grid.insertBefore(col, folder_grid.firstChild)

                    let card = col.querySelector('.nav_item')
                    card.classList.add('highlight_select')

                    let header_link = card.querySelector('.header_link')
                    header_link.focus()

                    // UPDATE CARDS
                    update_cards(document.getElementById('main_view'))


                })

            } catch (err) {

                console.log(err)
                notification(err)

            }

            clear_selected_files()
            notification('extracted ' + source)

        }

    })

}

// COMPRESS
function compress(source) {

    notification('compressing ' + source + ' to dest ' + breadcrumbs.value)

    let filename = path.basename(source) + '.tar.gz'
    let filepath = breadcrumbs.value

    let file_exists = fs.existsSync(path.join(filepath, filename))

    if (file_exists == true) {

        let msg = 'confirm overwrite'
        ipcRenderer.send('confirm_overwrite', msg)

        ipcRenderer.on('overwrite_canceled', (e, res) => {
            hide_progress()
        })


        // ipcRenderer.on('overwrite_confirmed', (e, res) => {

        //     notification('overwriting file ' + destination)

        //     // BUILD COMPRESS COMMAND
        //     let cmd = 'cd "' + filepath + '"; tar czvf "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"' //var/www/websit'

        //     // let cmd = 'cd ' + breadcrumbs.value + ';/usr/bin/tar -xvf "' + source + '"'
        //     console.log('cmd ' + cmd)

        //     show_progress(card_id)
        //     exec(cmd, (err, stdout, stderr) => {

        //         if (!err) {

        //             try {

        //                 // GET REFERENCE TO FOLDER GRID
        //                 let grid = document.getElementById('file_grid')

        //                 // CREATE CARD OPTIONS
        //                 let options = {

        //                     id: 'file_card_10000',
        //                     href: filepath + '/' + filename,
        //                     linktext: filename,
        //                     grid: grid

        //                 }

        //                 //
        //                 // let folder_grid = document.getElementById('folder_grid')
        //                 notification('filename ' + filename)
        //                 add_card(options).then(card => {
        //                     grid.insertBefore(card, grid.firstChild)
        //                     // update_cards()
        //                 })

        //             } catch (err) {
        //                 notification(err)
        //             }

        //         } else {
        //             clear_selected_files()
        //             notification('error ' + err)
        //         }

        //     })

        //     clear_selected_files()

        // })

    } else {


        // BUILD COMPRESS COMMAND
        let cmd = 'cd "' + filepath + '"; tar czf  "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"'


        // let cmd = 'cd ' + breadcrumbs.value + ';/usr/bin/tar -xvf "' + source + '"'
        console.log('cmd ' + cmd)

        exec(cmd, (err, stdout, stderr) => {

            // console.log(stdout)

            if (!err) {

                try {

                    // GET REFERENCE TO FOLDER GRID
                    let grid = document.getElementById('file_grid')

                    // CREATE CARD OPTIONS
                    let options = {

                        id: 'file_card_10000',
                        href: filepath + '/' + filename,
                        linktext: filename,
                        grid: grid
                    }

                    //
                    // let folder_grid = document.getElementById('folder_grid')
                    notification('filename ' + filename)

                    add_card(options).then(col => {

                        grid.insertBefore(col, grid.firstChild)

                        let card = col.querySelector('.card')
                        card.classList.add('highlight_select')
                        update_cards(grid)

                    })

                } catch (err) {

                    notification(err)

                }

                // hide_progress(card_id)
                clear_selected_files()


            } else {
                notification('error: ' + err)
            }

        })



        let c = 0
        let stats
        let stats1
        let href_stats = fs.statSync(source)
        let href_size = href_stats.size

        console.log('source is ' + source)

        // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
        let progress_file_card = document.getElementById('progress_' + card_id)
        let progress_bar = document.getElementById('progress_bar_' + card_id)

        progress_file_card.classList.remove('hidden')

        var interval_id = setInterval(() => {

            // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
            // let progress_file_card = document.getElementById('progress_' + card_id)
            // let progress_bar = document.getElementById('progress_bar_' + card_id)

            // progress_file_card.classList.remove('hidden')

            let file = path.join(filepath, filename)
            let file_exists = fs.existsSync(file)

            // COUNT ELAPSED SECONDS
            c = c + 1

            if (file_exists) {
                stats1 = stats
                stats = fs.statSync(file)

                // LET STATS1 GET POPULATED
                if (c > 1) {

                    // EXIT INTERVAL IF FILE SIZE DOESNT CHANGE
                    if (stats1.size == stats.size) {
                        progress_file_card.classList.add('hidden')
                        clearInterval(interval_id)
                    }

                }

                // CALCULATE TRANSFER RATE
                let transferspeed = stats.size / c
                let transfer_time = href_size / transferspeed
                let transfer_data_amount = transferspeed * transfer_time

                // CHECK PROGRESS
                // console.log('uncompressed size is  ' + get_file_size(uncompressed_size))
                console.log('transfer speed is  ' + get_file_size(transferspeed))
                console.log('transfer time is  ' + get_file_size(transfer_time))
                console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                // UPDATE PROGRESS
                if (c < 5) {

                    if (fs.statSync(source).isDirectory() === true) {

                        console.log('running ' + source + '....................')

                        ipcRenderer.send('get_folder_size', { dir: source })

                        ipcRenderer.on('folder_size', (e, data) => {

                            transfer_time = data.size / transferspeed
                            progress_bar.max = Math.floor(transfer_time)

                            // // CHECK PROGRESS
                            // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                            // console.log('transfer time is  ' + Math.floor(transfer_time))
                            // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                        })

                    } else {
                        console.log('setting progress max to ' + Math.floor(transfer_time))
                        progress_bar.max = Math.floor(transfer_time)

                        // // CHECK PROGRESS
                        // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                        // console.log('transfer time is  ' + Math.floor(transfer_time))
                        // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                    }

                }

                if (progress_bar) {
                    progress_bar.value = c
                }

            }


        }, 1000);


        clear_selected_files()

    }
}

//////////////////////////////////////////////////////////////////

// CONTEXT MENU COMMANDS
// FILES AND BLANK AREA
ipcRenderer.on('context-menu-command', (e, command, args) => {

    // OPEN TEMPLATES FOLDER
    if (command == 'open_templates_folder') {
        get_files(path.join(__dirname, 'assets/templates'), { sort: localStorage.getItem('sort') })
    }

    // EXTRACT HERE
    if (command === 'extract_here') {

        extract(source)

    }

    // COMPRESS HERE
    if (command === 'compress_folder') {

        notification('compressing ' + source + ' to dest ' + breadcrumbs.value)

        let filename = path.basename(source) + '.tar.gz'
        let filepath = breadcrumbs.value

        let file_exists = fs.existsSync(path.join(filepath, filename))

        if (file_exists == true) {

            let msg = 'confirm overwrite'
            ipcRenderer.send('confirm_overwrite', msg)

            ipcRenderer.on('overwrite_canceled', (e, res) => {
                hide_progress()
            })

        } else {


            // BUILD COMPRESS COMMAND
            let cmd = 'cd "' + filepath + '"; tar czf  "' + path.basename(source) + '.tar.gz" "' + path.basename(source) + '"'
            console.log('cmd ' + cmd)

            exec(cmd, (err, stdout, stderr) => {

                if (!err) {

                    try {

                        // GET REFERENCE TO FOLDER GRID
                        let grid = document.getElementById('file_grid')

                        // CREATE CARD OPTIONS
                        let options = {

                            id: 'file_card_10000',
                            href: filepath + '/' + filename,
                            linktext: filename,
                            grid: grid
                        }

                        //
                        // let folder_grid = document.getElementById('folder_grid')
                        notification('filename ' + filename)

                        add_card(options).then(col => {

                            grid.insertBefore(col, grid.firstChild)

                            let card = col.querySelector('.card')
                            card.classList.add('highlight_select')
                            // update_cards()

                        })

                    } catch (err) {

                        notification(err)

                    }

                    // hide_progress(card_id)
                    clear_selected_files()


                } else {
                    notification('error: ' + err)
                }

            })



            let c = 0
            let stats
            let stats1
            let href_stats = fs.statSync(source)
            let href_size = href_stats.size

            console.log('source is ' + source)

            // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
            let progress_file_card = document.getElementById('progress_' + card_id)
            let progress_bar = document.getElementById('progress_bar_' + card_id)

            progress_file_card.classList.remove('hidden')

            var interval_id = setInterval(() => {

                // GET REFREFENCE TO PROGRESS AND PROGRESS BAR
                // let progress_file_card = document.getElementById('progress_' + card_id)
                // let progress_bar = document.getElementById('progress_bar_' + card_id)

                // progress_file_card.classList.remove('hidden')

                let file = path.join(filepath, filename)
                let file_exists = fs.existsSync(file)

                // COUNT ELAPSED SECONDS
                c = c + 1

                if (file_exists) {
                    stats1 = stats
                    stats = fs.statSync(file)

                    // LET STATS1 GET POPULATED
                    if (c > 1) {

                        // EXIT INTERVAL IF FILE SIZE DOESNT CHANGE
                        if (stats1.size == stats.size) {
                            progress_file_card.classList.add('hidden')
                            clearInterval(interval_id)
                        }

                    }

                    // CALCULATE TRANSFER RATE
                    let transferspeed = stats.size / c
                    let transfer_time = href_size / transferspeed
                    let transfer_data_amount = transferspeed * transfer_time

                    // CHECK PROGRESS
                    // console.log('uncompressed size is  ' + get_file_size(uncompressed_size))
                    console.log('transfer speed is  ' + get_file_size(transferspeed))
                    console.log('transfer time is  ' + get_file_size(transfer_time))
                    console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                    // UPDATE PROGRESS
                    if (c < 5) {

                        if (fs.statSync(source).isDirectory() === true) {

                            console.log('running ' + source + '....................')

                            ipcRenderer.send('get_folder_size', { dir: source })

                            ipcRenderer.on('folder_size', (e, data) => {

                                transfer_time = data.size / transferspeed
                                progress_bar.max = Math.floor(transfer_time)

                                // // CHECK PROGRESS
                                // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                                // console.log('transfer time is  ' + Math.floor(transfer_time))
                                // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                            })

                        } else {
                            console.log('setting progress max to ' + Math.floor(transfer_time))
                            progress_bar.max = Math.floor(transfer_time)

                            // // CHECK PROGRESS
                            // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                            // console.log('transfer time is  ' + Math.floor(transfer_time))
                            // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                        }

                    }

                    if (progress_bar) {
                        // console.log('progress value is ' + get_file_size(c))
                        progress_bar.value = c
                    }

                    // // CHECK PROGRESS
                    // console.log('transfer speed is  ' + get_file_size(transferspeed) + ' /s')
                    // console.log('transfer time is  ' + Math.floor(transfer_time))
                    // console.log('data transfer amount is ' + get_file_size(transfer_data_amount))

                }


            }, 1000);


            clear_selected_files()

        }

    }

    // RELOAD
    if (command === 'reload') {
        mainWindow.loadURL(mainAddr);
    }

    // NEW WINDOW
    if (command === 'new_window') {
        ipcRenderer.send('new_window')
    }

    // todo: these need input checking

    // CREATE NEW FOLDER
    if (command === 'new_folder') {

        let folder = breadcrumbs.value
        console.log(folder)

        if (folder != '') {
            create_folder(folder + '/Untitled Folder')
        }

    }

    // DELETE COMMAND
    delete_arr = []
    if (command === 'delete') {

        // CLEAR ARRAY
        delete_arr = []
        // CLEAR LIST
        let list = ''

        // GET HIGHLIGHTED ITEMS
        // let items = document.getElementsByClassName('highlight_select')
        let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
        if (items.length > 0) {

            // LOOP OVER ITEMS AND ADD TO DELETE ARRAY
            for (let i = 0; i < items.length; i++) {

                let item = items[i]
                let href = item.getAttribute('data-href')

                let file = {
                    card_id: item.id,
                    source: href
                }

                delete_arr.push(file)
                list += href + '\n'

            }

            ipcRenderer.send('confirm_file_delete', list)

        }

    }

    // FILES /////////////////////////////////////////////////////////////////////

    // CREATE FILE
    if (command === 'new_file') {

        // alert('test')
        // console.log(breadcrumbs.value)
        // create_file()

    }

    // RENAME FILE
    if (command === 'rename') {

        href2 = source

        console.log('card id ' + card_id)
        let card = document.getElementById(card_id)

        if (card) {

            let header = card.querySelector('a')
            let input = card.querySelector('input')

            header.classList.add('hidden')
            input.classList.remove('hidden')

            console.log('running focus')
            input.focus()
            input.select()

        }

    }


    // COPY FILE OR FOLDER
    if (command === 'copy') {

        let highlight = document.querySelectorAll('.highlight, .highlight_select', 'ds-selected')

        if (highlight.length > 0) {

            let source
            let card_id
            let c1 = 0;
            let c2 = 0;
            highlight.forEach((item, idx) => {

                source = item.querySelector('a').getAttribute('href')
                card_id = item.id
                add_copy_file(source, card_id)

                 if (fs.statSync(source).isDirectory()) {
                    ++c1;
                } else {
                    ++c2;
                }

            })

            notification(c1 + ' Folers ' + c2 + ' Files copied');

        }

    }

    // PASTE COMMAND
    if (command === 'paste') {

        // PAST FILES
        paste();

    }


    // DELETE FILE. DELETE COMMAND
    if (command === 'delete_file') {


        // console.log('source ' + source)

        // let source_list = ''
        // // clear_selected_files()

        // add_selected_file(source, card_id)
        // if(selected_files.length > 0) {

        //     selected_files.forEach((files,idx) => {
        //         source_list += files.source + '\n'
        //     })

        // }else {

        //     console.log('delete file source: ' + source)

        // }

        // console.log('source list ' + source_list)

        // // SEND A COMMAND TO MAIN TO SHOW A CONFIRMATION DIALOG
        // ipcRenderer.send('confirm_file_delete', source_list)

    }

    // // CONFIRM DELETE FOLDER
    // ipcRenderer.on('delete_folder_confirmed',(e, res) => {

    //     alert('what')

    //     // delete_confirmed()

    //     // if(fs.statSync(source).isDirectory()){

    // //   delete_folder(source)
    // //   console.log('delete folder confirmed ' + source)

    // // }else {

    // //   console.log('im a file. i should not be running ' + source)

    // // }

    // // CLEAR ARRAY
    // // clear_selected_files()
    //     // loaddata(breadcrumbs.value)

    // })


    // IF WE RECIEVE DELETE CONFIRMED THEN DELETE FILE/S
    ipcRenderer.on('delete_file_confirmed', (e, res) => {

        delete_confirmed()

    })

    // OPEN TERMINAL
    if (command === 'menu_terminal') {

        get_terminal()

    }

    // OPEN VSCODE
    if (command === 'vscode') {
        // notification('running vscode')
        console.log('running vscode')
        exec('cd "' + source + '"; code .')
        // execSync('cd "'  + breadcrumbs.value + '"; code .')
    }

    // OPEN WITH
    if (command === 'open_with_application') {

        // ipcRenderer.on('open_with_application', (e, res) => {

        let cmd = args

        console.log('cmd args', args)

        // let filename = path.basename(source)
        // let filepath = path.dirname(source)

        cmd = cmd.replace('%U', "'" + source + "'")
        cmd = cmd.replace('%F', "'" + source + "'")

        cmd = cmd.replace('%u', "'" + source + "'")
        cmd = cmd.replace('%f', "'" + source + "'")

        console.log('cmd ' + cmd)
        exec(cmd)

        clear_selected_files()

    }

    // FILE PROPERTIES
    if (command === 'props') {

        ipcRenderer.send('get_file_properties', source)
        // get_file_properties(source)

    }

})


// RUN ON CONTEXT MENU CLOSE
ipcRenderer.on('clear_selected_files', (e, res) => {

    clear_selected_files()

})

// ON DOCUMENT LOAD
window.addEventListener('DOMContentLoaded', () => {

    // CHECK WHAT THIS IS
    // ipcRenderer.on('devices', (_event, text) => replaceText('devices', text))

    // GET GIO DEVICE LIST
    // let device_grid = document.getElementById('device_grid')
    // device_grid.innerHTML = ''
    ipcRenderer.send('get_gio_devices')

    // GET WORKSPACE
    workspace_arr = []
    get_workspace()

    // GET NETWORK
    get_network()

    // const replaceText = (selector, text) => {
    //     const element = document.getElementById(selector)
    //     if (element) element.innerText = text
    // }
    // for (const dependency of ['chrome', 'node', 'electron']) {
    //     replaceText(`${dependency}-version`, process.versions[dependency])
    // }
    // ipcRenderer.on('devices', (_event, text) => replaceText('devices', text))

    // INITIALIZE DRAG SELECT
    ds = new DragSelect({
        // area: document.getElementById('main_view'),
        selectorClass: 'drag_select',
    })


    // BACKSPACE
    Mousetrap.bind('alt+right', () => {

        console.log('back pressed')
        navigate('right')

    })


    // ALT+E EXTRACT
    Mousetrap.bind('shift+e', (e) => {

        e.preventDefault()
        console.log('extracting file')

        // GET SELECTED ITEMS
        let items = document.querySelectorAll('.highlight, .highlight_select, .ds-selected')
        if (items.length > 0) {

            // LOOP OVER ITEMS AND ADD TO DELETE ARRAY
            for (let i = 0; i < items.length; i++) {
                let item = items[i]
                let href = item.getAttribute('data-href')
                extract(href)
            }
        }


    })

    Mousetrap.bind('shift+c', (e) => {

        let href = ''
        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {

                let item = items[i]

                if (item.classList.contains('highlight') || item.classList.contains('highlight_select')) {
                    href = item.dataset.href
                    console.log('source ' + href)
                    compress(href)
                }
            }
        }

    })


    // KEYBOARD SHORTCUTS SECTION
    Mousetrap.bind('ctrl+a', (e) => {

        e.preventDefault()

        let card = document.getElementsByClassName('highlight')

        if (card.length > 0) {

            let grid = card[0].closest('.grid')
            let cards = grid.getElementsByClassName('card')

            for (let i = 0; i < cards.length; i++) {
                cards[i].classList.add('highlight_select')
            }

        } else {

            let main_view = document.getElementById('main_view')
            let nav_item = main_view.querySelectorAll('.nav_item')
            nav_item.forEach(item => {
                item.classList.add('highlight_select')

            })
            info(nav_item.length + ' items selected')

        }

    })


    // CTRL S SHOW SIDEBAR
    Mousetrap.bind('ctrl+b', (e) => {

        let sidebar = document.getElementById('sidebar')

        console.log(sidebar.hidden)

        if (sidebar.classList.contains('hidden')) {

            show_sidebar()
            localStorage.setItem('sidebar', 1)
            console.log('show side bar')

        } else {
            hide_sidebar()
            localStorage.setItem('sidebar', 0)
            console.log('hide side bar')
        }

    })



})




// // WATCH DIRECTORY FOR CHANGES
// fs.watch(breadcrumbs.value, "", (eventtype, filename) => {

//     //     // watch_count = watch_count + 1

//     //     let grid
//     //     let filepath = path.join(dir,filename)
//     //     let stats = fs.statSync(filepath)
//     //     let idx = 0

//     // IF EVENT TYPE IS CHANGE THEN SOMETHING WAS ADDED
//     if (eventtype == 'change') {

//         console.log('eventtype ' + eventtype + ' trigger ' + filename)

//         //         if (stats.isDirectory()) {

//         //             grid = document.getElementById('folder_grid')
//         //             idx = grid.getElementsByClassName('folder_card').length

//         //         } else {

//         //             grid = document.getElementById('file_grid')
//         //             idx = grid.getElementsByClassName('file_card').length
//         //         }

//         //         let options = {

//         //             id: grid.id + '_'+ idx + 1,
//         //             href: filepath,
//         //             linktext: filename,
//         //             grid: grid
//         //         }

//         //         try {

//         //             add_card(options).then(card => {

//         //                 console.log('what THE')
//         //                 grid.insertBefore(card, grid.firstChild)

//         //                 // setTimeout(() => {
//         //                 //     watch_count = 0
//         //                 // }, 5000);

//         //             })

//         //         } catch (err) {

//         //             notification(err)

//         //         }

//     }


// })





    // function get(href) {
    //     var xhttp = new XMLHttpRequest();
    //     xhttp.onreadystatechange = function() {
    //       if (this.readyState == 4 && this.status == 200) {
    //        document.getElementById("demo").innerHTML = this.responseText;
    //       }
    //     };
    //     xhttp.open("GET", href, true);
    //     xhttp.send();
    // }






/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// // WATCH DIRECTORY FOR CHANGES
            // fs.watch(dir, "", (eventtype, filename) => {

            //     // watch_count = watch_count + 1

            //     let grid
            //     let filepath = path.join(dir,filename)
            //     let stats = fs.statSync(filepath)
            //     let idx = 0

            //     // IF EVENT TYPE IS CHANGE THEN SOMETHING WAS ADDED
            //     if (eventtype == 'change' && watch_count == 0) {

            //         console.log('eventtype ' + eventtype + ' trigger ' + filename)

            //         if (stats.isDirectory()) {

            //             grid = document.getElementById('folder_grid')
            //             idx = grid.getElementsByClassName('folder_card').length

            //         } else {

            //             grid = document.getElementById('file_grid')
            //             idx = grid.getElementsByClassName('file_card').length
            //         }

            //         let options = {

            //             id: grid.id + '_'+ idx + 1,
            //             href: filepath,
            //             linktext: filename,
            //             grid: grid
            //         }

            //         try {

            //             add_card(options).then(card => {

            //                 console.log('what THE')
            //                 grid.insertBefore(card, grid.firstChild)

            //                 // setTimeout(() => {
            //                 //     watch_count = 0
            //                 // }, 5000);

            //             })

            //         } catch (err) {

            //             notification(err)

            //         }

            //     }


            // })


