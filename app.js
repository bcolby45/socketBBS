const express = require('express');
const path = require('path');
const http = require('http');
const ejs = require('ejs');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const app = express();
const webServer = http.createServer(app);
const AssetLoader = require('./src/assets/AssetLoader');
// WebSockets
const webSocketServer = require('ws').Server;
const ws = new webSocketServer(
    {
        server: webServer,
    },
);

const asset = new AssetLoader(
    path.resolve('./public/static/manifest.json'),
    path.resolve('./public/static/entrypoints.json'),
);

//run the websocket webserver
webServer.listen(80, function listening() {
    console.log('Listening on %d', webServer.address().port);
});

//name variables
const cloudflare = false;
const throttledUsers = new Set();
const throttledUsers2 = new Set();
// Connection URL
const dbUrl = 'mongodb://username:password@localhost/admin';
// Use connect method to connect to the server
let database;
MongoClient
    .connect(dbUrl, {
        useNewUrlParser: true,
    })
    .then((client) => {
        console.log('|> MongoDB connected!');
        database = client.db('admin');
    })
    .catch((err) => {
        console.error('|> MongoDB failed to initiate.');
        console.error(err);
        process.exit(0);
    });

// view engine setup
app.engine('html', ejs.renderFile);
app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));
app.get('/', (req, res) => {
    const options = {
        asset: asset.getFileHtml.bind(asset),
        assetUri: asset.getFile.bind(asset),
        files: asset.getAsset('main'),
    };

    return res.render('index', options);
});

app.use(express.static(path.join(__dirname, 'public')));

// don't kill the process if a library fails
process.on('uncaughtException', function(err) {
    console.log('UNCAUGHT EXCEPTION\n' + err);
});

const clients = new Map();

ws.on('connection', function connection(ws, req) {
    // get, store and verify client IP
    const ID = makeID();
    const realIP = cloudflare ? req.headers[ 'cf-connecting-ip' ] : req.connection.remoteAddress;
    console.log(`${ realIP } just connected.`);

    // set client states
    if (clients.has(ID)) {
        clients.delete(ID);
        console.log(`${ realIP } disconnected.`);
    }

    clients.set(ID, {
        socket: ws,
        board: 0,
        threadID: 0,
        ID: ID,
    });
    // Update user count on client side
    wsBroadcastBoard(
        JSON.stringify(
            {
                command: 'getUsers',
                argument: clients.size,
            },
        ),
        0,
    );

    ws.on('close', function() {
        //remove client from currently connected users
        clients.delete(ID);
        // Update user count on client side
        wsBroadcastBoard(
            JSON.stringify(
                {
                    command: 'getUsers',
                    argument: clients.size,
                },
            ),
            0,
        );
    });

    ws.on('message', function incoming(message) {
        for (let i = 0; i < message.length; i++) {
            if (message[ i ].match(`/[^\x00-\x7F]/g`)) {
                return wsAlert(ID, 'Your post contains illegal characters. Please try again.');
            }
        }

        if (ws.readyState !== 1) {
            return;
        }

        // prevent users the server isn't aware of from connecting
        if (!ID) {
            return wsAlert(ID, 'Error.');
        }

        const msg = message.split(',');
        // submitting a reply
        if (msg[ 0 ] === 'submitMessage') {
            //Formulate contents of post
            const postArr = [];
            for (let i = 0; i < msg.length; i++) {
                if (i > 3) {
                    postArr.push(msg[ i ]);
                }
            }

            const post = postArr.join();

            if (post.length > 1500) {
                return wsAlert(ID, 'Your post is too long. Please try again.');
            }

            const currBoard = msg[ 1 ];
            const threadID = msg[ 2 ];
            const nick = msg[ 3 ];

            if (currBoard > 0) {
                return;
            }

            // is this a valid command? if so, continue
            if (msg[ 0 ] in cmd && post.length > 0) {
                const funct = cmd[ msg[ 0 ] ];
                funct(ID, currBoard, threadID, nick, post, realIP);
            }
        }

        // submit a thread
        if (msg[ 0 ] === 'submitThread') {
            const postArr = [];
            for (let i = 0; i < msg.length; i++) {
                if (i > 2) {
                    postArr.push(msg[ i ]);
                }
            }

            const post = postArr.join();

            if (post.length > 1500) {
                return wsAlert(ID, 'Your post is too long. Please try again.');
            }

            if (post.length < 35) {
                return wsAlert(ID, 'Your post is too short. Please try again.');
            }

            const currBoard = msg[ 1 ];
            const nick = msg[ 2 ];

            if (currBoard > 0) {
                return;
            }

            // is this a valid command? if so, continue
            if (msg[ 0 ] in cmd && post.length > 0) {
                let funct = cmd[ msg[ 0 ] ];
                funct(ID, currBoard, nick, post, realIP);
            }
        }
        // get and display threads
        if (msg[ 0 ] === 'getThreads') {
            const currBoard = msg[ 1 ];
            clients.set(ID, {
                socket: ws,
                board: currBoard,
                threadID: 0,
                ID: ID,
                upload: ``,
            });

            if (currBoard > 0) {
                return;
            }

            if (msg[ 0 ] in cmd) {
                const funct = cmd[ msg[ 0 ] ];
                funct(ID, currBoard);
            }
        }
        // get and display posts within a thread
        if (msg[ 0 ] === 'getMessages') {
            const currBoard = msg[ 1 ];
            const threadID = msg[ 2 ];

            //update client states
            clients.set(ID, {
                socket: ws,
                board: currBoard,
                threadID: threadID,
                ID: ID,
            });

            if (currBoard > 0) {
                return;
            }

            if (msg[ 0 ] in cmd) {
                const funct = cmd[ msg[ 0 ] ];
                funct(ID, currBoard, threadID);
            }
        }
    });

    // Server commands go here
    const cmd = {
        getMessages: (ID, boardNum, threadID) => {
            if (ws.readyState !== 1) {
                return;
            }

            if (boardNum !== 0) {
                boardNum = 0;
            }

            console.log(`${ boardNum }:${ threadID } to ${ ID }.`);
            clients.get(ID).board = boardNum;
            database
                .collection('posts')
                .find(
                    {
                        board: boardNum,
                        threadID: threadID,
                    },
                )
                .limit(400)
                .toArray(function(err, docs) {
                    assert.strictEqual(err, null);
                    console.log(`${ ID } requested contents of ${ threadID }`);
                    ws.send(
                        JSON.stringify(
                            {
                                command: 'displayMessages',
                                argument: docs,
                            },
                        ),
                    );
                });
        },

        getThreads: (ID, boardNum) => {
            if (ws.readyState !== 1) {
                return;
            }

            if (boardNum !== 0) {
                boardNum = 0;
            }

            console.log(`Board ${ boardNum } to ${ ID }.`);
            clients.get(ID).board = boardNum;
            database
                .collection('threads')
                .find(
                    {
                        board: boardNum,
                    },
                )
                .sort(
                    {
                        'date': -1,
                    },
                )
                .limit(400)
                .toArray(function(err, docs) {
                    assert.strictEqual(err, null);
                    wsBroadcastBoard(
                        JSON.stringify(
                            {
                                command: 'displayThreads',
                                argument: docs,
                            },
                        ),
                        boardNum,
                    );
                });
        },
        submitMessage: (ID, boardNum, threadID, nick, post, realIP) => {
            if (ws.readyState !== 1) {
                return;
            }

            boardNum = Number(boardNum);

            const dateNow = Date.now();

            if (!post) {
                return wsAlert(ID, 'No message submitted.');
            } else if (throttledUsers.has(realIP)) {
                return wsAlert(ID, 'You may only submit a new post every second.');
            }

            // spam prevention
            throttledUsers.add(realIP);
            clearThrottles(realIP);
            if (post.length > 1500) {
                return;
            }

            const posts = database.collection('posts');
            const threads = database.collection('threads');
            const username = nick || 'Anonymous';

            if (!post) {
                return;
            }

            posts
                .find()
                .limit(1)
                .sort(
                    {
                        $natural: -1,
                    },
                )
                .toArray((err, docs) => {
                    assert.strictEqual(err, null);
                    const postID = docs[ 0 ] ? docs[ 0 ].postID + 1 : 1;
                    const messageObj = {
                        board: boardNum,
                        nick: username,
                        message: post,
                        threadID: threadID,
                        IP: realIP,
                        date: dateNow,
                        postID: postID,
                    };

                    threads
                        .updateOne(
                            {
                                threadID: threadID,
                            },
                            {
                                $set: {
                                    date: dateNow,
                                },
                            },
                        )
                        .then(() => posts.insertOne(messageObj))
                        .then(() => {
                            console.log(`completed message submission to #${ threadID } time to broadcast`);
                            wsBroadcastThread(
                                JSON.stringify(
                                    {
                                        command: 'displayMessage',
                                        argument: messageObj,
                                    },
                                ),
                                threadID,
                            );
                        });
                });

        },
        submitThread: (ID, boardNum, nick, message, realIP) => {
            if (ws.readyState !== 1) {
                return;
            }

            if (boardNum !== 0) {
                boardNum = 0;
            }

            if (message > 1500) {
                return;
            }

            if (!message) {
                return wsAlert(ID, 'You didn\'t enter a message.');
            }

            if (throttledUsers2.has(realIP)) {
                return wsAlert(ID, 'Please wait longer before submitting a new thread.');
            }

            throttledUsers2.add(realIP);
            clearThrottles2(realIP);
            const dateNow = Date.now();
            const collection = database.collection('threads');
            const collection2 = database.collection('posts');
            const username = nick || 'Anonymous';

            if (!message) {
                return;
            }

            collection
                .find()
                .limit(1)
                .sort(
                    {
                        $natural: -1,
                    },
                )
                .toArray((err) => {
                    assert.strictEqual(err, null);
                    const threadID = makeID();
                    const threadObj = {
                        board: boardNum,
                        nick: username,
                        message: message,
                        threadID: threadID,
                        IP: realIP,
                        date: dateNow,
                    };

                    if (!threadObj || !threadID) {
                        return;
                    }

                    collection
                        .insertOne(threadObj)
                        .then(() => {
                            collection2
                                .find()
                                .limit(1)
                                .sort(
                                    {
                                        $natural: -1,
                                    },
                                )
                                .toArray((err, docs) => {
                                    assert.strictEqual(err, null);
                                    const postID = docs[ 0 ] ? docs[ 0 ].postID + 1 : 1;
                                    const messageObj = {
                                        board: boardNum,
                                        nick: username,
                                        message: message,
                                        threadID: threadID,
                                        IP: realIP,
                                        date: dateNow,
                                        postID: postID,
                                    };
                                    if (messageObj && postID > -1) {
                                        collection2.insertOne(messageObj);
                                    }
                                });
                        })
                        .then(() => {
                            setTimeout(() => {
                                cmd.getThreads(ID, boardNum);
                            }, 500);
                        });

                });

        },
    };
});

//broadcast only to users on a certain board
function wsBroadcastBoard(data, boardNum) {
    clients.forEach(function(client) {
        if (client.socket.readyState !== 1) {
            return;
        }

        if (client.board === boardNum) {
            client.socket.send(data);
        }
    });
}

//broadcast only to users in a certain thread
function wsBroadcastThread(data, threadID) {
    clients.forEach(function(client) {
        if (client.socket.readyState !== 1) {
            return;
        }

        if (client.threadID === threadID) {
            client.socket.send(data);
        }
    });
}

//broadcast only to a specific user
function wsBroadcastUser(ID, data) {
    clients.forEach(function(client) {
        if (client.socket.readyState !== 1) {
            return;
        }

        if (client.ID === ID) {
            client.socket.send(data);
        }
    });
}

function wsAlert(ID, alertStr) {
    const newAlert = JSON.stringify(
        {
            alert: alertStr,
        },
    );

    wsBroadcastUser(ID, newAlert);
}

function clearThrottles(IP) {
    setTimeout(function() {
        throttledUsers.delete(IP);
        console.log(throttledUsers);
    }, 1000);
}

function clearThrottles2(IP) {
    setTimeout(function() {
        throttledUsers2.delete(IP);
        console.log(throttledUsers2);
    }, 1000000);
}

function makeID() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 16; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}
