const electron = require('electron');
const { Menu, ipcMain, Tray } = require('electron');
const Store = require('electron-store');
let contextMenu = require('electron-context-menu');

const app =  electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const url = require('url');
const store = new Store();

const fs = require('fs');
const http = require('http');
const https = require('https');

let mainWindow = null, loginWindow = null, tray = null, blackList = [], isFailover = false;


contextMenu({
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showCopyImage: false,
    showCopyImageAddress: false,
    showInspectElement: false,
    showSaveImage: false,
    showSaveImageAs: false,
    showSaveLinkAs: false,
    showServices: false
});

function setup() {
    let template = [
        {
            label: 'Failover Proxy',
            submenu: [{
                label: 'Exit',
                click: _ => { app.quit() }
            }]
        }
    ];
    if (process.platform === 'darwin') {
        template.push({
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    selector: 'undo:'
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    selector: 'redo:'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    selector: 'cut:'
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    selector: 'copy:'
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    selector: 'paste:'
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    selector: 'selectAll:'
                }
            ]
        });

        loadSettings();
    }
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    openLoginScreen();
}

function openLoginScreen() {
    if (loginWindow !== null) {
        loginWindow.show();
        return;
    }

    loginWindow = new BrowserWindow({
        height: 775,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    loginWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'two.html'),
        protocol: 'file',
        slashes: true
    }));

    loginWindow.once('ready-to-show', _ => {
        loginWindow.show();
    });

    loginWindow.on('closed', e => {
        loginWindow = null;
    });
}

function openMainWindow() {
    if (mainWindow !== null) {
        mainWindow.show();
        return;
    }

    mainWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            enableRemoteModule: true,
        }
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'one.html'),
        protocol: 'file',
        slashes: true
    }));

    mainWindow.once('ready-to-show', _ => {
        mainWindow.maximize();
        mainWindow.show();
    });

    mainWindow.on('close', e => {
        e.preventDefault();

        mainWindow.hide();
    });
    mainWindow.webContents.openDevTools();
}

function createTray() {
    tray = new Tray('images/TrayIcon.png');
    tray.setToolTip('Failover Proxy');
    tray.on('click', _ => {
        if (mainWindow.isVisible()) return;

        openLoginScreen();
    });
}

function loadSettings() {
    blackList = store.get('blackList');
}

app.on('ready', _ => {
    createTray();
    setup();
});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin'){
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null){
        setup();
    }
});

ipcMain.on('storeget', (e, arg) => {
    e.returnValue = store.get(arg);
});

ipcMain.on('storeset', (e, key, val) => {
    store.set(key, val);
    loadSettings();
    e.returnValue = true;
});

ipcMain.on('login-success', e => {
    openMainWindow();

    loginWindow.close();
});

ipcMain.on('logout-success', e => {
    mainWindow.hide();
    openLoginScreen();

    e.returnValue = true;
});

ipcMain.on('set-failover', (e, val) => {
    isFailover = val;
    e.returnValue = true;
});

function ip_allowed(ip) {
    return true;
}

function host_allowed(host) {
    if (! isFailover) return true;

    for (var i = 0; i < blackList.length; i++){
        console.log(blackList[i])
        if (blackList[i].test(host)) {
            return false;
        }
    }

    return true;
}

function deny(response, msg) {
    response.writeHead(401);
    response.write(msg);
    response.end();
}

http.createServer(function (request, response) {
    let ip = request.socket.remoteAddress;
    if (! ip_allowed(ip)) {
        let msg = "IP " + ip + " is not allowed to use this proxy";
        deny(response, msg);
        console.log(msg);
        return;
    }

    if (! host_allowed(request.url)) {
        let msg = "Host " + request.url + " has been denied by proxy configuration because the network is in failover";
        deny(response, msg);
        console.log(msg);
        return;
    }

    console.log(ip + ": " + request.method + " " + request.url);
    let proxy_request = http.request({
        port: request.socket.localPort,
        host: request.headers['host'],
        method: request.method,
        path: request.url,
        headers: request.headers
    });
    proxy_request.addListener('response', function (proxy_response) {
        proxy_response.addListener('data', function (chunk) {
            response.write(chunk, 'binary');
        });
        proxy_response.addListener('end', function () {
            response.end();
        });
        response.writeHead(proxy_response.statusCode, proxy_response.headers);
    });
    request.addListener('data', function (chunk) {
        proxy_request.write(chunk, 'binary');
    });
    request.addListener('end', function () {
        proxy_request.end();
    });
}).listen(8080, '127.0.0.1');

const options = {
    key: fs.readFileSync('cert.key'),
    cert: fs.readFileSync('cert.crt')
};

https.createServer(options, function (request, response) {
    let ip = request.socket.remoteAddress;
    if (! ip_allowed(ip)) {
        let msg = "IP " + ip + " is not allowed to use this proxy";
        deny(response, msg);
        console.log(msg);
        return;
    }

    if (! host_allowed(request.url)) {
        let msg = "Host " + request.url + " has been denied by proxy configuration because the network is in failover";
        deny(response, msg);
        console.log(msg);
        return;
    }

    console.log(ip + ": " + request.method + " " + request.url);
    let proxy_request = https.request({
        port: request.socket.localPort,
        host: request.headers['host'],
        method: request.method,
        path: request.url,
        headers: request.headers
    });
    proxy_request.addListener('response', function (proxy_response) {
        proxy_response.addListener('data', function (chunk) {
            response.write(chunk, 'binary');
        });
        proxy_response.addListener('end', function () {
            response.end();
        });
        response.writeHead(proxy_response.statusCode, proxy_response.headers);
    });
    request.addListener('data', function (chunk) {
        proxy_request.write(chunk, 'binary');
    });
    request.addListener('end', function () {
        proxy_request.end();
    });
}).listen(8081, '127.0.0.1');
