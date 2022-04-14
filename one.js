const { ipcRenderer } = require('electron');
const fetch = require('node-fetch');
const fs = require('fs');

let whiteList = ipcRenderer.sendSync('storeget', 'whitelist') || [];
let blackList = ipcRenderer.sendSync('storeget', 'blackList') || [];
let fixedIps = ipcRenderer.sendSync('storeget', 'fixedips') || [];
let isFailover = false;
const addButtons = document.querySelectorAll('.action-add-to-list');

for (const addButton of addButtons) {
    addButton.addEventListener('click', e => {
        e.preventDefault();

        const listUl = e.target.parentNode.parentNode.children[1].children[0];
        const textInput = e.target.parentNode.children[0];

        if (textInput.value == '') return;

        listUl.innerHTML = listUl.innerHTML + `<li>${textInput.value}<span>x</span></li>`;

        saveSettings();
        attachEventListeners();

        textInput.value = '';
    });
}
window.addEventListener('load', _ => {
    document.getElementById('btnTest').addEventListener('click', e => {
        console.log(whiteList, blackList, fixedIps);
    });

    loadExternalIpAddress();

    provisionData('ulwhite', 'whitelist');
    provisionData('ulblack', 'blackList');
    provisionData('ulvast', 'fixedips');

    attachEventListeners();
});


async function loadExternalIpAddress() {
    const apiResponse = await fetch('https://api.ipify.org?format=json');
    const data = await apiResponse.json();
    const statusIP = document.getElementById('StatusIp');

    document.getElementById('currentIpAddress').innerText = data.ip;
    if (fixedIps.includes(data.ip)) {
        isFailover = false;
        statusIP.innerHTML = 'ONLINE';
        statusIP.style.color = "rgb(0, 255, 0)";
        if (!ipcRenderer.sendSync('set-failover', isFailover)) {
            alert('connection is solid, not in failover');
        }

        return;
    }

    isFailover = true;
    statusIP.innerHTML = 'OFFLINE';
    statusIP.style.color = "red";

    if (!ipcRenderer.sendSync('set-failover', isFailover)) {
        alert('connection is lost, failover proxy activated');
    }
}

// Refresh failoverstatus every 3 minutes (180000)
setInterval(loadExternalIpAddress, 3000);

// Logout
const logoutButton = document.getElementById('Logout');
logoutButton.addEventListener('click', e => {
    e.preventDefault();

    ipcRenderer.sendSync('logout-success');
});

function provisionData(ul, storekey) {
    const ulElement = document.querySelector(`.${ul}`);
    const storedData = ipcRenderer.sendSync('storeget', storekey);

    if (storedData == undefined) return;

    let newUlContent = '';

    for (const entry of storedData) {
        newUlContent += `<li>${entry}<span>x</span></li>`;
    }

    ulElement.innerHTML = newUlContent;
}

function saveSettings() {
    for (const section of [['ulwhite', 'whitelist'], ['ulblack', 'blackList'], ['ulvast', 'fixedips']]) {
        const listitems = document.querySelectorAll(`.${section[0]} li`);
        let arrayToSave = [];

        for (const listitem of listitems) {
            arrayToSave.push(listitem.innerText.split('\n')[0].trim());
        }

        if (!ipcRenderer.sendSync('storeset', section[1], arrayToSave)) {
            alert('Something went wrong while saving the settings.');
            return;
        }
    }

    whiteList = ipcRenderer.sendSync('storeget', 'whitelist') || [];
    blackList = ipcRenderer.sendSync('storeget', 'blackList') || [];
    fixedIps = ipcRenderer.sendSync('storeget', 'fixedips') || [];

    saveToDisk(whiteList, blackList, fixedIps);
}

function saveToDisk(whiteList, blackList, fixedIps) {
    fs.writeFile("whiteList.txt", whiteList.join('\r\n'), (err) => {
        if (err) console.log(err);
    });
    fs.writeFile("blackList.txt", blackList.join('\r\n'), (err) => {
        if (err) console.log(err);
    });
    fs.writeFile("fixedIps.txt", fixedIps.join('\r\n'), (err) => {
        if (err) console.log(err);
    });
}

function attachEventListeners() {
    const closeButtons = document.querySelectorAll('span');

    for (const closeButton of closeButtons) {
        const btnClone = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(btnClone, closeButton);

        btnClone.addEventListener('click', function () {
            btnClone.parentElement.style.opacity = 0;

            setTimeout(() => {
                btnClone.parentElement.style.display = "none";
                btnClone.parentElement.remove();

                saveSettings();
            }, 500)
        });
    }
}

//PROXY SETUP
// var blacklist = [];
// var iplist    = [];

// fs.watchFile('./blackList.txt', function(c,p) { saveSettings(); });
// fs.watchFile('./fixedIps.txt', function(c,p) { saveSettings(); });

// function update_blacklist() {
//   console.log("Updating blacklist.");
//   blacklist = fs.readFileSync('blackList.txt',"utf8").split('\n')
//               .filter(function(rx) { return rx.length })
//               .map(function(rx) { return RegExp(rx) });
// }

// function update_iplist() {
//   console.log("Updating iplist.");
//   iplist = fs.readFileSync('fixedIps.txt',"utf8").split('\n')
//            .filter(function(rx) { return rx.length });
// }

// function ip_allowed(ip) {
//   for (i in iplist) {
//     if (iplist[i] == ip) {
//       return true;
//     }
//   }
//   return false;
// }

// function host_allowed(host) {
//   for (i in blacklist) {
//     if (blacklist[i].test(host)) {
//       return false;
//     }
//   }
//   return true;
// }

// function deny(response, msg) {
//   response.writeHead(401);
//   response.write(msg);
//   response.end();
// }

// http.createServer(function(request, response) {
//   var ip = request.socket.remoteAddress;
//   if (!ip_allowed(ip)) {
//     msg = "IP " + ip + " is not allowed to use this proxy";
//     deny(response, msg);
//     console.log(msg);
//     return;
//   }

//   if (!host_allowed(request.url)) {
//     msg = "Host " + request.url + " has been denied by proxy configuration";
//     deny(response, msg);
//     console.log(msg);
//     return;
//   }

//   console.log(ip + ": " + request.method + " " + request.url);
//   var proxy = http.request(80, request.headers['host'])
//   var proxy_request = proxy.request(request.method, request.url, request.headers);
//   proxy_request.addListener('response', function(proxy_response) {
//     proxy_response.addListener('data', function(chunk) {
//       response.write(chunk, 'binary');
//     });
//     proxy_response.addListener('end', function() {
//       response.end();
//     });
//     response.writeHead(proxy_response.statusCode, proxy_response.headers);
//   });
//   request.addListener('data', function(chunk) {
//     proxy_request.write(chunk, 'binary');
//   });
//   request.addListener('end', function() {
//     proxy_request.end();
//   });
// }).listen(8080,'127.0.0.1');

// update_blacklist();
// update_iplist();


