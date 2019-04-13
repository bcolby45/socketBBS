//Global variables
let lines, lines2, pictureNum, picUrl, socket, THREAD_TEMPLATE, OP_TEMPLATE, MESSAGE_TEMPLATE, sub, nick;
let thread = 0;
const board = 0;
let messages = [];
let threads = [];
let retries = -1;
const rcv = new Audio('./imrcv.wav');
const send = new Audio('./imsend.wav');
const drop = new Audio('./drop.wav');
//DOM elements 
const boardDom = document.getElementById('currBoard');
const threadListElement = document.getElementById('posts-container');
const messageListElement = document.getElementById('test-container');
let threadName = document.getElementById('threadName');
let threadMessage = document.getElementById('threadMessage');
let messageName = document.getElementById('messageName');
let messageVal = document.getElementById('messageVal');
//HTML templates
THREAD_TEMPLATE = `
<div class="post center">
    <div class="post-title">
    </div>
    <div class="post-text">
    </div>
</div>
`;
MESSAGE_TEMPLATE = `
<div class="message">
    <div style="float:left;">
        <div class="flex start">
            <div class="message-title">
            </div>
        </div>
        <div class="message-text">
        </div>
    </div>
</div>
`;
//client commands
const cmd = {
    domMessages: (snap) => {
        thread = snap[0].threadID;
        if (thread == "0") {return;}
        messageListElement.innerHTML = "";
        threadListElement.innerHTML = "";
        document.getElementById('messageBtn').classList.remove('hidden');
        document.getElementById('threadBtn').classList.add('hidden');
        document.getElementById('return').innerHTML = `Back`;
        let msgKey, i, x;
        if (snap.length < 500) {x = snap.length;}
        else {x = 500;}
        for (let i = 0; i < x; i++) {
            msgKey = document.getElementById(snap[i]._id);
            if (!msgKey && snap[i].board == 0 && i > -1) {
                let container = document.createElement('div');
                console.log(snap[i]);
                container.innerHTML = MESSAGE_TEMPLATE;
                container.setAttribute('id', snap[i]._id);
                messageListElement.appendChild(container);
                let titleElement = container.querySelector('.message-title');
                titleElement.innerHTML = snap[i].nick;
                titleElement.innerHTML = titleElement.innerHTML.replace(/(?:<audio>)/gi, '');
                let messageElement = container.querySelector('.message-text');
                messageElement.innerHTML = snap[i].message;
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
                messageElement.innerHTML = messageElement.innerHTML.replace(/(?:<audio>)/gi, '');
            }
        }
    },
    domThreads: (snap) => {
        if (thread !== 0) {thread = 0;}
        threadListElement.innerHTML = "";
        messageListElement.innerHTML = "";
        document.getElementById('threadBtn').classList.remove('hidden');
        document.getElementById('messageBtn').classList.add('hidden');
        document.getElementById('return').innerHTML = `Refresh`;
        let msgKey, threadKey;
        let i, x;
        if (snap.length - 1 >= 50) {x = 50;}
        else {x = snap.length;}
        for (i = 0; i < x; i++) {
            msgKey = document.getElementById(snap[i]._id);
            threadKey = document.getElementById(snap[i].threadID);
            if (!msgKey && !threadKey && snap[i].board == 0) {
                let container = document.createElement('div');
                container.innerHTML = THREAD_TEMPLATE;
                container.setAttribute('id', snap[i].threadID);
                container.setAttribute('onClick', `cmd.getMessages(0, this.getAttribute('id'))`);
                threadListElement.appendChild(container);
                let titleElement = container.querySelector('.post-title');
                titleElement.textContent = snap[i].nick;
                let messageElement = container.querySelector('.post-text');
                container.querySelector('.post-title').textContent = container.querySelector('.post-title').textContent.replace(/<[^>]*>/g, '');
                messageElement.textContent = snap[i].message;
                messageElement.textContent = messageElement.textContent.replace(/<[^>]*>/g, '');
                messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
                messageElement.innerHTML = messageElement.innerHTML.replace(/(?:<audio>)/gi, '');
            }
        }
    },
    getThreads: (board) => {
        socket.send([`getThreads`, board]);
    },
    getMessages: (board, threadID) => {
        socket.send([`getMessages`, board, threadID]);
    },
    displayThreads: (msg) => {
        thread = 0;
        document.getElementById('return').innerHTML = `Refresh`;
        threads = msg;
        cmd.domThreads(threads);
    },
    displayMessage: (msg) => {
        messages.push(msg);
        cmd.domMessages(messages);
        rcv.play();
    },
    displayMessages: (msg) => {
        messages = msg;
        cmd.domMessages(msg);
    },
    getUsers: (num) => {
        if (num > 0) {boardDom.innerHTML = `Users online: ${num}`;}
    }
};
//set connection status in DOM
let boardSet = (board) => {
    if (retries > 0) {boardDom.innerHTML = `<p>Connecting/Reconnecting... (${retries})</p>`;}
    else {boardDom.innerHTML = `<p>Connecting/Reconnecting...</p>`;}
};
let emitThread = (board) => {
    if (socket.readyState !== 1) {alert("Socket not connected. Please try again.");}
    const nick = document.getElementById('threadName').value;
    const message = document.getElementById('threadMessage').value;
    socket.send(['submitThread', board, nick, message]);
    clearInput1();
    threadFrm();
};
let emitPost = (board, thread) => {
    if (socket.readyState !== 1) {alert("Socket not connected. Please try again.");}
    const message = document.getElementById('messageVal').value;
    const nick = document.getElementById('messageName').value;
    socket.send(['submitMessage', board, thread, nick, message]);
    clearInput2();
    scrollDown();
    messageFrm();
};
let scrollDown = () => {
    window.scrollTo(0, document.body.scrollHeight);
};
let threadFrm = () => {
    document.getElementById('threadSubmit').classList.toggle('hidden');
    document.getElementById('return').classList.toggle('hidden');
    clearInput1();
};
let messageFrm = () => {
    document.getElementById('messageSubmit').classList.toggle('hidden');
    document.getElementById('return').classList.toggle('hidden');
    clearInput2();
};
let clearInput1 = () => {
    threadName.value = "";
    threadMessage.value = "";
};
let clearInput2 = () => {
    messageName.value = "";
    messageVal.value = "";
};
//lines for initialization
let init = () => {
    retries = retries + 1;
    socket = new WebSocket(`ws://${location.host}`);
    // Log errors to the console for debugging.
    socket.onerror = function (error) {
        console.log(error);
    };
    // Reconnect upon disconnect.
    socket.onclose = function () {
        console.log(`Your socket has been disconnected. Attempting to reconnect...`);
        setTimeout(function () {
            init();
        }, 1000);
    };
    socket.onmessage = function (message) {
        let parsedData = JSON.parse(message.data);
        let exec, arg;
        if (parsedData.alert) {
            alert(parsedData.alert);
        }
        else if (parsedData.command && !parsedData.argument) {
            exec = parsedData.command;
            if (exec in cmd) {
                cmd[exec]();
            }
        }
        else if (parsedData.command && parsedData.argument) {
            exec = parsedData.command;
            arg = parsedData.argument;
            if (exec in cmd) {
                cmd[exec](arg);
            }
        }
        else {console.log(`Error! ${parsedData}`);}
    };
    socket.onopen = function () {
        retries = -1;
        console.log('client connected successfully');
        if (thread == 0) {
            cmd.getThreads(board);
        }
        else {
            cmd.getMessages(board, thread);
        }
    };
};
//initialize
init();