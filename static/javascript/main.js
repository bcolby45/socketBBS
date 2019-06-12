require('../stylesheets/main.css');

//Global variables
let socket, THREAD_TEMPLATE, MESSAGE_TEMPLATE;
window.thread = '0';
const board = 0;
let messages = [];
let threads = [];
let retries = -1;
const rcv = new Audio(window.imrcvSrc);
//DOM elements
const boardDom = document.getElementById('currBoard');
const threadListElement = document.getElementById('posts-container');
const messageListElement = document.getElementById('test-container');
const threadName = document.getElementById('threadName');
const threadMessage = document.getElementById('threadMessage');
const messageName = document.getElementById('messageName');
const messageVal = document.getElementById('messageVal');
//HTML templates
THREAD_TEMPLATE = `
<div class="post center">
    <div class="post-title"></div>
    <div class="post-text"></div>
</div>
`;
MESSAGE_TEMPLATE = `
<div class="message">
    <div style="float:left;">
        <div class="flex start">
            <div class="message-title"></div>
        </div>
        <div class="message-text"></div>
    </div>
</div>
`;
//client commands
window.cmd = {
    domMessages: (messages) => {
        window.thread = String(messages[ 0 ].threadID);

        if (window.thread === '0') {
            return;
        }

        messageListElement.innerHTML = '';
        threadListElement.innerHTML = '';
        document.getElementById('messageBtn').classList.remove('hidden');
        document.getElementById('threadBtn').classList.add('hidden');
        document.getElementById('return').innerHTML = `Back`;

        const shownMessages = messages.slice(0, 500);
        for (const message of shownMessages) {
            const msgKey = document.getElementById(message._id);

            if (
                msgKey
                || String(message.board) !== '0'
            ) {
                continue;
            }

            const container = document.createElement('div');
            container.innerHTML = MESSAGE_TEMPLATE;
            container.setAttribute('id', message._id);

            messageListElement.appendChild(container);

            const titleElement = container.querySelector('.message-title');
            titleElement.textContent = message.nick;

            const messageElement = container.querySelector('.message-text');
            messageElement.textContent = message.message;
            messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
        }
    },

    domThreads: (threads) => {
        if (window.thread !== '0') {
            window.thread = '0';
        }

        threadListElement.innerHTML = '';
        messageListElement.innerHTML = '';
        document.getElementById('threadBtn').classList.remove('hidden');
        document.getElementById('messageBtn').classList.add('hidden');
        document.getElementById('return').innerHTML = `Refresh`;

        const shownThreads = threads.slice(0, 50);
        for (const thread of shownThreads) {
            const messageKey = document.getElementById(thread._id);
            const threadKey = document.getElementById(thread.threadID);

            if (
                messageKey
                || threadKey
                || String(thread.board) !== '0'
            ) {
                continue;
            }

            const container = document.createElement('div');
            container.innerHTML = THREAD_TEMPLATE;
            container.setAttribute('id', thread.threadID);
            container.setAttribute('onClick', `cmd.getMessages(0, this.getAttribute('id'))`);

            threadListElement.appendChild(container);

            const titleElement = container.querySelector('.post-title');
            titleElement.textContent = thread.nick;

            const messageElement = container.querySelector('.post-text');
            messageElement.textContent = thread.message;
            messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
        }
    },

    getThreads: (board) => {
        socket.send([ `getThreads`, board ]);
    },

    getMessages: (board, threadID) => {
        socket.send([ `getMessages`, board, threadID ]);
    },

    displayThreads: (msg) => {
        window.thread = '0';
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
        if (num > 0) {
            boardDom.innerHTML = `Users online: ${ num }`;
        }
    },
};

//set connection status in DOM
window.boardSet = (board) => {
    if (retries > 0) {
        boardDom.innerHTML = `<p>Connecting/Reconnecting... (${ retries })</p>`;
    } else {
        boardDom.innerHTML = `<p>Connecting/Reconnecting...</p>`;
    }
};

window.emitThread = (board) => {
    if (socket.readyState !== 1) {
        alert('Socket not connected. Please try again.');
    }

    const nick = document.getElementById('threadName').value;
    const message = document.getElementById('threadMessage').value;
    socket.send([ 'submitThread', board, nick, message ]);
    clearInput1();
    threadFrm();
};

window.emitPost = (board, thread) => {
    if (socket.readyState !== 1) {
        alert('Socket not connected. Please try again.');
    }

    const message = document.getElementById('messageVal').value;
    const nick = document.getElementById('messageName').value;
    socket.send([ 'submitMessage', board, thread, nick, message ]);
    clearInput2();
    scrollDown();
    messageFrm();
};

window.scrollDown = () => {
    window.scrollTo(0, document.body.scrollHeight);
};

window.threadFrm = () => {
    document.getElementById('threadSubmit').classList.toggle('hidden');
    document.getElementById('return').classList.toggle('hidden');
    clearInput1();
};

window.messageFrm = () => {
    document.getElementById('messageSubmit').classList.toggle('hidden');
    document.getElementById('return').classList.toggle('hidden');
    clearInput2();
};

window.clearInput1 = () => {
    threadName.value = '';
    threadMessage.value = '';
};

window.clearInput2 = () => {
    messageName.value = '';
    messageVal.value = '';
};

//lines for initialization
window.init = () => {
    retries = retries + 1;
    socket = new WebSocket(`ws://${ location.host }`);

    // Log errors to the console for debugging.
    socket.onerror = function(error) {
        console.log(error);
    };

    // Reconnect upon disconnect.
    socket.onclose = function() {
        console.log(`Your socket has been disconnected. Attempting to reconnect...`);
        setTimeout(function() {
            init();
        }, 1000);
    };

    socket.onmessage = function(message) {
        let parsedData = JSON.parse(message.data);
        let exec, arg;
        if (parsedData.alert) {
            alert(parsedData.alert);
        } else if (parsedData.command && !parsedData.argument) {
            exec = parsedData.command;
            if (exec in cmd) {
                cmd[ exec ]();
            }
        } else if (parsedData.command && parsedData.argument) {
            exec = parsedData.command;
            arg = parsedData.argument;
            if (exec in cmd) {
                cmd[ exec ](arg);
            }
        } else {
            console.log(`Error! ${ parsedData }`);
        }
    };

    socket.onopen = function() {
        retries = -1;
        console.log('client connected successfully');
        if (String(thread) === '0') {
            cmd.getThreads(board);
        } else {
            cmd.getMessages(board, thread);
        }
    };
};

//initialize
init();
