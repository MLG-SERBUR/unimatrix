var matrix_server, matrix_user, matrix_user_id, matrix_password, matrix_device_id;
var serverurl;
var matrix_access_token = "";
var matrix_login_token = "";
var roomlist;
var roomnames = [];
var roommessages;
var matrix_messagelimit;
var currentRoomId = "";
var currentRoomName = "";
var nextBatch = "";
var enableClientsync = 0;
var matrix_roomcache = [];
var matrix_usercache = [];
var sendingMessage = 0;
var converter = new showdown.Converter();

function loadSettings() {
    if (localStorage.getItem("matrix_server") === null) {
        console.log("matrix_server does not exist in localstorage. Creating ..");
        localStorage.matrix_server = "matrix.org";
        matrix_server = localStorage.matrix_server;
    } else {
        matrix_server = localStorage.matrix_server;
        console.log("matrix_server from localstorage: " + matrix_server);
    }

    if (localStorage.getItem("matrix_user") === null) {
        //console.log("matrix_user does not exist in localstorage.");
    } else {
        matrix_user = localStorage.matrix_user;
        console.log("matrix_user from localstorage: " + matrix_user);
    }

    if (localStorage.getItem("matrix_user_id") === null) {
        //console.log("matrix_user does not exist in localstorage.");
    } else {
        matrix_user_id = localStorage.matrix_user_id;
        console.log("matrix_user_id from localstorage: " + matrix_user_id);
    }

    if (localStorage.getItem("matrix_access_token") === null) {
        //console.log("matrix_accesskey does not exist in localstorage.");
    } else {
        matrix_access_token = localStorage.matrix_access_token;
        console.log("matrix_access_token from localstorage: " + matrix_access_token);
    }

    if (localStorage.getItem("matrix_password") === null) {
        //console.log("matrix_password does not exist in localstorage.");
    } else {
        matrix_password = localStorage.matrix_password;
        console.log("matrix_password from localstorage: " + matrix_password);
    }

    if (localStorage.getItem("matrix_login_token") === null) {
        //console.log("matrix_login_token does not exist in localstorage.");
    } else {
        matrix_login_token = localStorage.matrix_login_token;
        console.log("matrix_login_token from localstorage: " + matrix_login_token);
    }

    if (localStorage.getItem("matrix_device_id") === null) {
        //console.log("matrix_device_id does not exist in localstorage.");
    } else {
        matrix_device_id = localStorage.matrix_device_id;
        console.log("matrix_device_id from localstorage: " + matrix_device_id);
    }

    if (localStorage.getItem("matrix_messagelimit") === null) {
        console.log("matrix_messagelimit does not exist in localstorage. Creating ..");
        localStorage.matrix_messagelimit = "50";
        matrix_messagelimit = localStorage.matrix_messagelimit;
    } else {
        matrix_messagelimit = localStorage.matrix_messagelimit;
        console.log("matrix_messagelimit from localstorage: " + matrix_messagelimit);
    }

    if (localStorage.getItem("matrix_roomcache") === null) {
        console.log("matrix_roomcache does not exist in localstorage.");
    } else {
        try {
            matrix_roomcache = JSON.parse(localStorage.matrix_roomcache);
            console.log("matrix_roomcache from localstorage: " + matrix_roomcache.length + " rooms");
        } catch (e) {
            console.error("Error parsing matrix_roomcache from localstorage:", e);
            matrix_roomcache = [];
        }
    }

    if (localStorage.getItem("matrix_usercache") === null) {
        console.log("matrix_usercache does not exist in localstorage.");
    } else {
        try {
            matrix_usercache = JSON.parse(localStorage.matrix_usercache);
            console.log("matrix_usercache from localstorage: " + matrix_usercache.length + " users");
        } catch (e) {
            console.error("Error parsing matrix_usercache from localstorage:", e);
            matrix_usercache = [];
        }
    }
    localStorage.removeItem("matrix_avatarLinks");

    serverurl = "https://" + matrix_server;
}

function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp);
    var year = a.getFullYear();
    var month = a.getMonth() + 1;
    if (month < 10) { month = '0' + month }
    var day = a.getDate();
    if (day < 10) { day = '0' + day }
    var hour = a.getHours();
    if (hour < 10) { hour = '0' + hour }
    var min = a.getMinutes();
    if (min < 10) { min = '0' + min }
    var time = year + '-' + month + '-' + day + ' ' + hour + ':' + min;
    return time;
}

function getRandomColor() {
    let randomcolor = "#" + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, "0");
    return randomcolor;
}

function getUserColor(userId) {
    if (!userId) return "#FFFFFF";
    // Extract username part (e.g., @user from @user:matrix.org)
    let username = userId.split(":")[0];
    if (username.startsWith("@")) username = username.substring(1);

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to HSL for controlled visibility
    // Hue: 0-360, Saturation: 70%, Lightness: 65% (good for dark backgrounds)
    let h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 65%)`;
}

function fetchUserProfile(userId) {
    // Check cache first
    let cached = matrix_usercache.find(u => u.userId == userId);
    if (cached) return Promise.resolve(cached);

    let query = serverurl + "/_matrix/client/v3/profile/" + userId + "?access_token=" + matrix_access_token;
    return new Promise((resolve) => {
        $.ajax({
            url: query,
            type: 'GET',
            dataType: 'json',
            success(response) {
                let avatarUrl = "";
                if (response.avatar_url) {
                    avatarUrl = serverurl + "/_matrix/client/v1/media/download/" + response.avatar_url.substring(6) + "?access_token=" + matrix_access_token;
                }
                let userData = {
                    userId: userId,
                    displayname: response.displayname || userId,
                    avatarUrl: avatarUrl
                };
                matrix_usercache.push(userData);
                localStorage.matrix_usercache = JSON.stringify(matrix_usercache);
                resolve(userData);
            },
            error() {
                // Fallback for failed fetch
                let userData = {
                    userId: userId,
                    displayname: userId,
                    avatarUrl: ""
                };
                resolve(userData);
            }
        });
    });
}

function convertDIVname(name) {
    let result = name.replace(/!/g, "X");
    result = result.replace(/:/g, "C");
    result = result.replace(/\./g, "D");
    return result;
}

function scrollToBottom(force) {
    var element = document.getElementById("roomcontent");
    if (element) {
        // If force is true, or user is already near the bottom (within 150px)
        let isNearBottom = (element.scrollHeight - element.scrollTop - element.clientHeight) < 150;
        if (force || isNearBottom) {
            element.scrollTop = element.scrollHeight;
        }
    }
}

function getDiscoveryInformation() {
    let query = serverurl + "/.well-known/matrix/client";
    $("#activityicon").show();
    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            console.log(response);
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function getSupportedVersions() {
    let query = serverurl + "/_matrix/client/versions";
    $("#activityicon").show();
    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            console.log(response);
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function syncClient(since) {
    $("#syncled").css("background-color", "orange");
    var query = "";
    if (since == "" || since == undefined) {
        console.log("Running initial sync ..")
        query = serverurl + "/_matrix/client/r0/sync?access_token=" + matrix_access_token;
    }
    else {
        console.log("Running incremental sync ..")
        query = serverurl + "/_matrix/client/r0/sync?since=" + since + "&access_token=" + matrix_access_token;
    }
    //$("#activityicon").show();
    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            //$("#activityicon").hide();
            $("#syncled").css("background-color", "greenyellow");
            console.log(response);
            nextBatch = response.next_batch;
            console.log("Sync completed. next_batch=" + nextBatch);
            enableClientsync = 1;
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            //$("#activityicon").hide();
            $("#syncled").css("background-color", "red");
        },
    });
}

function checkLoginstate() {
    if (matrix_access_token != "") {
        authenticateUser();
    }
    else {
        showLoginmenu();
    }
}

function checkLogindata() {
    $("#login_notification").html("");

    let loginserver = $("#login_server").val();
    let loginuser = $("#login_username").val();
    let loginpass = $("#login_password").val();

    if (loginserver == "" || loginuser == "" || loginpass == "") {
        $("#login_notification").html("Information missing, please complete all inputs.")
    }
    else {
        matrix_server = loginserver;
        matrix_user = loginuser;
        matrix_password = loginpass;
        authenticateUser();
    }
}

function authenticateUser() {
    let query = serverurl + "/_matrix/client/r0/login";
    var querydata;
    $("#activityicon").show();

    if (matrix_access_token != "") {
        console.log("Already have an access token, login skipped.");
        authSuccess();
    }
    else {
        if (matrix_login_token == "") {
            console.log("Logging in with username/password ..")
            querydata = `{
                          "identifier": {
                            "type": "m.id.user",
                            "user": "`+ matrix_user + `"
                          },
                          "initial_device_display_name": "Jungle Phone",
                          "password": "`+ matrix_password + `",
                          "type": "m.login.password"
                     }`
        }
        else {
            console.log("Using token-based login ..")
            querydata = `{
                          "token": "` + matrix_access_token + `",
                          "type": "m.login.token"
                     }`
        }
        console.log(querydata);
        $.ajax({
            url: query,
            type: 'POST',
            data: querydata,
            dataType: 'json',
            contentType: "application/json",
            success(response) {
                $("#activityicon").hide();
                matrix_access_token = response.access_token;
                matrix_device_id = response.device_id;
                matrix_user_id = response.user_id;

                localStorage.matrix_access_token = matrix_access_token;
                localStorage.matrix_device_id = matrix_device_id;
                localStorage.matrix_user_id = matrix_user_id;
                localStorage.matrix_user = matrix_user;
                localStorage.matrix_password = matrix_password;

                console.log(response);
                authSuccess();
            },
            error(jqXHR, status, errorThrown) {
                console.log('failed to fetch ' + query)
                $("#activityicon").hide();
                matrix_password = "";
                matrix_access_token = "";
                localStorage.matrix_password = "";
                localStorage.matrix_access_token = matrix_access_token;
                if ($("#loginmenu").css("display") != "none") {
                    $("#login_notification").html('Login failed, please check your username and password');
                }
            },
        });
    }
}

function authSuccess() {
    $("#header_text").html("[ " + matrix_user_id + " ]");
    if ($("#loginmenu").css("display") != "none") {
        $("#loginmenu").hide();
    }
    $("#login_server").val("matrix.org");
    $("#login_username").val("");
    $("#login_password").val("");
    $("#header_mainbutton").html('<img src="images/menu.png" onclick="toggleSidemenu()" />')
    getRoomlist();
}

function whoAmI() {
    let query = serverurl + "/_matrix/client/r0/account/whoami?access_token=" + matrix_access_token;
    $("#activityicon").show();
    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            console.log(response);
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function logoutUser() {
    matrix_access_token = '';
    localStorage.matrix_access_token = '';
    toggleSidemenu();
    loadSettings();
    checkLoginstate();
}

function getRoomlist() {
    let query = serverurl + "/_matrix/client/r0/joined_rooms?access_token=" + matrix_access_token;
    var querydata;
    $("#activityicon").show();

    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            roomlist = response.joined_rooms;
            roomitems = roomlist.length;
            console.log(roomitems);
            console.log(roomlist);
            for (let i = 0; i < roomitems; i++) {
                let roomId = roomlist[i]
                getRoomname(roomId, roomitems);
            }
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function getRoomAlias(roomId, mode) {
    $("#roominfo_alias").html("");
    let query = serverurl + "/_matrix/client/r0/rooms/" + roomId + "/aliases?access_token=" + matrix_access_token;
    var querydata;
    $("#activityicon").show();

    let avatarcount = matrix_roomcache.length;
    for (let a = 0; a < avatarcount; a++) {
        let avataritem = matrix_roomcache[a];
        if (avataritem.roomId == roomId) {
            if (avataritem.alias != "") {
                $("#roominfo_alias").html(avataritem.alias);
                if (mode != "forced") {
                    console.log("alias of " + avataritem.alias + " taken from cache")
                    return;
                }
            }
        }
    }

    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            let aliases = response.aliases;
            let aliascount = aliases.length;
            let latestitem = aliascount - 1;
            let latestalias = aliases[latestitem];
            $("#roominfo_alias").html(latestalias);

            let avatarcount = matrix_roomcache.length;
            for (let a = 0; a < avatarcount; a++) {
                let avataritem = matrix_roomcache[a];
                if (avataritem.roomId == roomId) {
                    console.log(latestalias);
                    avataritem.alias = latestalias;
                    localStorage.matrix_roomcache = JSON.stringify(matrix_roomcache);
                }
            }
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function getRoomname(roomId, roomLimit) {
    let query = serverurl + "/_matrix/client/r0/rooms/" + roomId + "/state/m.room.name?access_token=" + matrix_access_token;
    $("#activityicon").show();

    $.ajax({
        url: query,
        type: 'GET',
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            //console.log(response);
            roomnames[roomId] = response.name;
            var nameitems = Object.keys(roomnames).length;
            if (nameitems == roomLimit) {
                printRoomnames();
            }
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
            // Fallback to roomId if fetching name fails
            roomnames[roomId] = roomId;
            var nameitems = Object.keys(roomnames).length;
            if (nameitems == roomLimit) {
                printRoomnames();
            }
        },
    });
}

function printRoomnames() {
    var nameitems = Object.keys(roomnames).length;
    let contenthtml = "";
    for (let i = 0; i < nameitems; i++) {
        let roomId = Object.keys(roomnames)[i]
        let roomName = Object.values(roomnames)[i]
        let divName = convertDIVname(roomId);
        contenthtml += `<div class="channel" onclick='openRoom("` + roomId + `")'>
                            <div class="channelavatar" id="avatar_` + divName + `"></div>
                            <div class="channelname">` + roomName + `</div>
                        </div>`;
    }
    contenthtml += "";
    $("#channellist").html(contenthtml);
    printAvatars();
}

function printAvatars() {
    var nameitems = Object.keys(roomnames).length;
    for (let i = 0; i < nameitems; i++) {
        let roomId = Object.keys(roomnames)[i]
        getRoomAvatar(roomId);
    }
}

function getRoomMessages(roomId, checkEventId, checkBody, forceScroll) {
    let roomName = roomnames[roomId];
    let query = serverurl + "/_matrix/client/r0/rooms/" + roomId + "/messages?access_token=" + matrix_access_token;
    $("#activityicon").show();

    $.ajax({
        url: query,
        type: 'GET',
        data: {
            dir: 'b',
            limit: matrix_messagelimit,
        },
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            console.log(response);
            roommessages = response;
            let messages = roommessages.chunk;
            let messagecount = messages.length;
            let roomhtml = '';
            var foundCheckId = 0;
            // Process messages in reverse order (chronological: oldest to newest)
            for (let i = messagecount - 1; i >= 0; i--) {
                let messagecontent = messages[i].content;
                let messagetimestamp = messages[i].origin_server_ts;
                let sender = messages[i].sender;
                let ts = timeConverter(messagetimestamp);
                var messageclass;
                if (sender == matrix_user_id) {
                    messageclass = "mymessage";
                }
                else {
                    messageclass = "message";
                }

                if (messagecontent.hasOwnProperty("msgtype")) {
                    let bodyContent = "";

                    if (messagecontent.msgtype == "m.text" || messagecontent.msgtype == "m.notice") {
                        bodyContent = converter.makeHtml(messagecontent.body);
                    } else if (messagecontent.msgtype == "m.image") {
                        let mxc = messagecontent.url;
                        if (mxc) {
                            let httpUrl = serverurl + "/_matrix/client/v1/media/download/" + mxc.substring(6) + "?access_token=" + matrix_access_token;
                            let imgStyle = "max-width: 100%; max-height: 400px; display: block; object-fit: contain;";
                            if (messagecontent.info && messagecontent.info.w && messagecontent.info.h) {
                                imgStyle += ` aspect-ratio: ${messagecontent.info.w} / ${messagecontent.info.h}; width: 100%; max-width: ${messagecontent.info.w}px; height: auto;`;
                            }
                            bodyContent = `<img src="${httpUrl}" loading="lazy" style="${imgStyle}" /><br>${converter.makeHtml(messagecontent.body)}`;
                        } else {
                            bodyContent = converter.makeHtml(messagecontent.body) + " (Image missing URL)";
                        }
                    } else if (messagecontent.msgtype == "m.video") {
                        let mxc = messagecontent.url;
                        if (mxc) {
                            let httpUrl = serverurl + "/_matrix/client/v1/media/download/" + mxc.substring(6) + "?access_token=" + matrix_access_token;
                            bodyContent = `<video controls src="${httpUrl}" preload="metadata" style="max-width: 100%;"></video><br>${converter.makeHtml(messagecontent.body)}`;
                        }
                    } else if (messagecontent.msgtype == "m.audio") {
                        let mxc = messagecontent.url;
                        if (mxc) {
                            let httpUrl = serverurl + "/_matrix/client/v1/media/download/" + mxc.substring(6) + "?access_token=" + matrix_access_token;
                            bodyContent = `<audio controls src="${httpUrl}"></audio><br>${converter.makeHtml(messagecontent.body)}`;
                        }
                    } else if (messagecontent.msgtype == "m.file") {
                        let mxc = messagecontent.url;
                        if (mxc) {
                            let httpUrl = serverurl + "/_matrix/client/v1/media/download/" + mxc.substring(6) + "?access_token=" + matrix_access_token;
                            bodyContent = `<a href="${httpUrl}" target="_blank">📄 ${converter.makeHtml(messagecontent.body)}</a>`;
                        }
                    } else {
                        // Fallback for unknown types
                        bodyContent = converter.makeHtml(messagecontent.body);
                    }

                    let userColor = getUserColor(sender);
                    let userProfile = matrix_usercache.find(u => u.userId == sender);
                    let displayname = userProfile ? userProfile.displayname : sender;
                    let avatarHtml = "";

                    if (userProfile && userProfile.avatarUrl) {
                        avatarHtml = `<img src="${userProfile.avatarUrl}" class="user-avatar" />`;
                    } else {
                        // Generic avatar with initial
                        let initial = (displayname.startsWith("@") ? displayname.substring(1) : displayname).charAt(0).toUpperCase();
                        avatarHtml = `<div class="user-avatar generic-user-avatar" style="background-color: ${userColor}">${initial}</div>`;
                    }

                    if (!userProfile) {
                        fetchUserProfile(sender); // Trigger fetch for next time
                    }

                    roomhtml += `
                        <div class="${messageclass}">
                            <div class="message-header">
                                ${avatarHtml}
                                <div class="sender" style="color: ${userColor}">${displayname}</div>
                            </div>
                            <div class="message-body">${bodyContent}</div>
                            <div class="timestamp">${ts} - ${sender.split(":")[1]}</div>
                        </div>`;
                }
                //console.log(messagecontent);
                if (checkEventId != undefined) {
                    if (messages[i].event_id == checkEventId) {
                        foundCheckId = 1;
                    }
                }
            }

            if (checkEventId != undefined && foundCheckId == 0) {
                let ts = timeConverter(Date.now());
                let userColor = getUserColor(matrix_user_id);
                let userProfile = matrix_usercache.find(u => u.userId == matrix_user_id);
                let displayname = userProfile ? userProfile.displayname : matrix_user_id;
                let avatarHtml = "";
                if (userProfile && userProfile.avatarUrl) {
                    avatarHtml = `<img src="${userProfile.avatarUrl}" class="user-avatar" />`;
                } else {
                    let initial = (displayname.startsWith("@") ? displayname.substring(1) : displayname).charAt(0).toUpperCase();
                    avatarHtml = `<div class="user-avatar generic-user-avatar" style="background-color: ${userColor}">${initial}</div>`;
                }

                roomhtml += `
                    <div class="mymessage">
                        <div class="message-header">
                            ${avatarHtml}
                            <div class="sender" style="color: ${userColor}">${displayname}</div>
                        </div>
                        <div class="message-body">${converter.makeHtml(checkBody)}</div>
                        <div class="timestamp">${ts} - ${matrix_user_id.split(":")[1]}</div>
                    </div>`;
            }

            var element = document.getElementById("roomcontent");
            let isNearBottom = (element.scrollHeight - element.scrollTop - element.clientHeight) < 150;

            $("#roomcontent").html(roomhtml);

            if (forceScroll || isNearBottom) {
                element.scrollTop = element.scrollHeight;
            }
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function getRoomMembers(roomId, mode) {
    let roomName = roomnames[roomId];
    $("#roominfo_membercount").html("");
    let query = serverurl + "/_matrix/client/r0/rooms/" + roomId + "/joined_members?access_token=" + matrix_access_token;
    $("#activityicon").show();

    let avatarcount = matrix_roomcache.length;
    for (let a = 0; a < avatarcount; a++) {
        let avataritem = matrix_roomcache[a];
        if (avataritem.roomId == roomId) {
            if (avataritem.membercount != "") {
                $("#roominfo_membercount").html(avataritem.membercount + " members");
                if (mode != "forced") {
                    console.log("membercount of " + avataritem.membercount + " taken from cache")
                    return;
                }
            }
        }
    }

    $.ajax({
        url: query,
        type: 'GET',
        data: {
            membership: "join",
            not_membership: "leave"
        },
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            try {
                let joined = response.joined;
                let membercount = Object.keys(joined).length
                console.log(membercount + " members");
                $("#roominfo_membercount").html(membercount + " members")

                let avatarcount = matrix_roomcache.length;
                for (let a = 0; a < avatarcount; a++) {
                    let avataritem = matrix_roomcache[a];
                    if (avataritem.roomId == roomId) {
                        avataritem.membercount = membercount;
                        localStorage.matrix_roomcache = JSON.stringify(matrix_roomcache);
                    }
                }
            }
            catch (e) {
                let membercount = 0;
                console.log(membercount + " members");
                $("#roominfo_membercount").html(membercount + " members")
            }
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function getRoomAvatar(roomId) {
    let roomName = roomnames[roomId];
    let query = serverurl + "/_matrix/client/r0/rooms/" + roomId + "/messages?access_token=" + matrix_access_token;
    var filter = '{"types":["m.room.avatar"]}';

    let avatarcount = matrix_roomcache.length;
    for (let a = 0; a < avatarcount; a++) {
        let avataritem = matrix_roomcache[a];
        if (avataritem.roomId == roomId) {
            if (avataritem.type == "link") {
                let avatarlink = avataritem.link;
                setRoomAvatar(roomId, avatarlink);
                console.log("avatar from cache for " + roomId);
                return;
            }
            if (avataritem.type == "div") {
                let avatarColor = avataritem.color;
                setRoomAvatar(roomId, "", avatarColor);
                console.log("generic avatar from cache for " + roomId);
                return;
            }
        }
    }

    $("#activityicon").show();
    $.ajax({
        url: query,
        type: 'GET',
        data: {
            dir: "b",
            limit: 1,
            filter, filter
        },
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            if (response.hasOwnProperty("chunk")) {
                if (response.chunk != null) {
                    try {
                        let mxclink = response.chunk[0].content.url;
                        let path = mxclink.slice(6);
                        let avatarlink = serverurl + "/_matrix/client/v1/media/download/" + path + "?access_token=" + matrix_access_token;
                        //console.log(avatarlink);
                        setRoomAvatar(roomId, avatarlink);
                        let avataritem = {
                            roomId: roomId,
                            type: "link",
                            link: avatarlink,
                            alias: "",
                            membercount: ""
                        };

                        matrix_roomcache.push(avataritem);
                        localStorage.matrix_roomcache = JSON.stringify(matrix_roomcache);
                    }
                    catch (e) {
                        let avatarColor = getRandomColor();
                        setRoomAvatar(roomId, "", avatarColor);
                        let avataritem = {
                            roomId: roomId,
                            type: "div",
                            color: avatarColor,
                            alias: "",
                            membercount: ""
                        };

                        matrix_roomcache.push(avataritem);
                        localStorage.matrix_roomcache = JSON.stringify(matrix_roomcache);
                    }
                }
                else {
                    console.log("No avatar events found in room " + roomId);
                }
            }
            else {
                console.log("No chunk item found in room " + roomId);
            }
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function setRoomAvatar(roomId, avatarlink, avatarColor) {
    let roomName = roomnames[roomId];
    if (avatarlink != "") {
        let divName = convertDIVname(roomId);
        let divAvatar = "#avatar_" + divName;
        $(divAvatar).html(`<img src="` + avatarlink + `" />`);

        if (currentRoomId == roomId) {
            $("#header_avatar").html(`<img src="` + avatarlink + `" onclick=openRoominfo("` + roomId + `") />`);
            $("#roominfo_avatar_imagearea").html(`<img src="` + avatarlink + `" />`);
        }
    }
    else {
        let avatarLetter = roomName.charAt().toUpperCase()
        let roomlisthtml = `<div class="generic_avatar" style="background-color: ` + avatarColor + `;">` + avatarLetter + `</div>`
        let headerhtml = `<div class="generic_avatar_header" style="background-color: ` + avatarColor + `;" onclick=openRoominfo("` + roomId + `")>` + avatarLetter + `</div>`
        let infohtml = `<div class="generic_avatar_info" style="background-color: ` + avatarColor + `;">` + avatarLetter + `</div>`;

        let divName = convertDIVname(roomId);
        let divAvatar = "#avatar_" + divName;
        $(divAvatar).html(roomlisthtml);

        if (currentRoomId == roomId) {
            $("#header_avatar").html(headerhtml);
            $("#roominfo_avatar_imagearea").html(infohtml);
        }
    }
}

function sendRoomMessage(roomId) {

    let message = $("#messageinput").val();
    let fileInput = document.getElementById('chat_file_input');
    let hasFile = fileInput && fileInput.files.length > 0;

    if (roomId == "" || (message == "" && !hasFile)) {
        return;
    }

    sendingMessage = 1;
    let oldcontent = $("#roomcontent").html();

    // Optimistic UI update
    let displayMessage = message;
    if (hasFile) {
        displayMessage = (message ? message + "<br>" : "") + "[Uploading " + fileInput.files[0].name + "...]";
    }

    let userColor = getUserColor(matrix_user_id);
    let userProfile = matrix_usercache.find(u => u.userId == matrix_user_id);
    let displayname = userProfile ? userProfile.displayname : matrix_user_id;
    let avatarHtml = "";
    if (userProfile && userProfile.avatarUrl) {
        avatarHtml = `<img src="${userProfile.avatarUrl}" class="user-avatar" />`;
    } else {
        let initial = (displayname.startsWith("@") ? displayname.substring(1) : displayname).charAt(0).toUpperCase();
        avatarHtml = `<div class="user-avatar generic-user-avatar" style="background-color: ${userColor}">${initial}</div>`;
    }

    tempcontent = oldcontent + `
        <div class="message">
            <div class="message-header">
                ${avatarHtml}
                <div class="sender" style="color: ${userColor}">${displayname}</div>
            </div>
            <div class="message-body">${converter.makeHtml(displayMessage)}</div>
            <div class="timestamp">Sending .. - ${matrix_user_id.split(":")[1]}</div>
        </div>`;
    $("#roomcontent").html(tempcontent);
    scrollToBottom(true); // Sending a message should force scroll

    let transactionId = Date.now();
    let query = serverurl + "/_matrix/client/r0/rooms/" + roomId + "/send/m.room.message/" + transactionId + "?access_token=" + matrix_access_token;
    $("#activityicon").show();

    let promise;
    if (hasFile) {
        let file = fileInput.files[0];
        let dimensionsPromise = file.type.startsWith("image/") ? getImageDimensions(file) : Promise.resolve({});

        promise = Promise.all([uploadMedia(file), dimensionsPromise]).then(([content_uri, dimensions]) => {
            let msgType = "m.file";
            if (file.type.startsWith("image/")) msgType = "m.image";
            else if (file.type.startsWith("video/")) msgType = "m.video";
            else if (file.type.startsWith("audio/")) msgType = "m.audio";

            let info = {
                mimetype: file.type,
                size: file.size
            };

            if (dimensions.w && dimensions.h) {
                info.w = dimensions.w;
                info.h = dimensions.h;
            }

            return {
                body: message || file.name,
                filename: file.name,
                msgtype: msgType,
                url: content_uri,
                info: info
            };
        });
    } else {
        promise = Promise.resolve({
            body: message,
            msgtype: "m.text",
        });
    }

    promise.then(content => {
        $.ajax({
            url: query,
            type: 'PUT',
            data: JSON.stringify(content),
            dataType: 'json',
            success(response) {
                $("#messageinput").val("");
                $("#messageinput").blur();
                if (fileInput) {
                    fileInput.value = "";
                    updateAttachmentStatus(); // Reset button color
                }
                $("#activityicon").hide();
                console.log(response);
                getRoomMessages(roomId, response.event_id, content.body, true);
                sendingMessage = 0;
            },
            error(jqXHR, status, errorThrown) {
                console.log('failed to fetch ' + query)
                console.log(status);
                $("#activityicon").hide();
                sendingMessage = 0;
            },
        });
    }).catch(error => {
        console.error("Error sending message:", error);
        $("#activityicon").hide();
        sendingMessage = 0;
        // Optionally show error in UI
    });
}

function getRoomThreads(roomId) {
    let query = serverurl + "/_matrix/client/v1/rooms/" + roomId + "/threads?access_token=" + matrix_access_token;
    $("#activityicon").show();

    $.ajax({
        url: query,
        type: 'GET',
        data: {
            limit: 30,
        },
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            console.log(response);
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            $("#activityicon").hide();
        },
    });
}

function openRoom(roomId) {
    let roomName = roomnames[roomId];
    currentRoomId = roomId;
    currentRoomName = roomName;
    getRoomAvatar(roomId);
    $("#header_text").html("[ " + roomName + " ]");
    let inputhtml = `<input type="file" id="chat_file_input" style="display: none;" onchange="updateAttachmentStatus()">
                     <div id="attachmentbutton" onclick="triggerAttachment()">
                        <img src="images/attach.svg" />
                     </div>
                     <input type="text" id="messageinput">
                     <div id="messagebutton" onclick=sendRoomMessage("`+ roomId + `")>
                     <img src="images/send.png" /></div>`;
    $("#roominput").html(inputhtml);
    $('#messageinput').keydown(function (event) {
        if (event.which === 13) {
            sendRoomMessage(roomId);
        }
    });
    let roomhtml = `<div class="message">fetching messages ..</div >`;
    $("#roomcontent").html(roomhtml);
    $("#room").show();
    $("#header_mainbutton").html('<img src="images/back.png" onclick="closeRoom()" />');
    let devicewidth = $(window).width();
    let buttonwidth = $("#messagebutton").width();
    let attachwidth = 40; // Approximate width of attachment button
    let remainwidth = devicewidth - buttonwidth - attachwidth - 75;
    $("#messageinput").width(remainwidth);
    getRoomMessages(roomId, undefined, undefined, true);
    getRoomAlias(roomId, "normal");
    getRoomMembers(roomId, "normal");
}

function triggerAttachment() {
    $("#chat_file_input").click();
}

function updateAttachmentStatus() {
    let fileInput = document.getElementById('chat_file_input');
    if (fileInput.files.length > 0) {
        $("#attachmentbutton").css("background-color", "#4CAF50"); // Green indicator
    } else {
        $("#attachmentbutton").css("background-color", "transparent");
    }
}

function uploadMedia(file) {
    return new Promise((resolve, reject) => {
        let query = serverurl + "/_matrix/media/r0/upload?filename=" + encodeURIComponent(file.name) + "&access_token=" + matrix_access_token;

        let reader = new FileReader();
        reader.onload = function (e) {
            $.ajax({
                url: query,
                type: 'POST',
                data: e.target.result,
                processData: false,
                contentType: file.type,
                success(response) {
                    console.log("Upload successful:", response);
                    resolve(response.content_uri);
                },
                error(jqXHR, status, errorThrown) {
                    console.error("Upload failed:", status, errorThrown);
                    reject(errorThrown);
                }
            });
        };
        reader.readAsArrayBuffer(file);
    });
}

function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = function () {
            let dimensions = { w: img.width, h: img.height };
            URL.revokeObjectURL(url);
            resolve(dimensions);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve({});
        };
        img.src = url;
    });
}

function closeRoom() {
    currentRoomId = "";
    currentRoomName = "";
    $("#header_text").html("[ " + matrix_user_id + " ]");
    $("#header_avatar").html(``);
    $("#header_mainbutton").html('<img src="images/menu.png" onclick="toggleSidemenu()" />')
    $("#room").hide();
}

function openRoominfo(roomId) {
    let roomName = roomnames[roomId];
    $("#header_mainbutton").html('<img src="images/back.png" onclick="closeRoominfo()" />');
    $("#roominfo").show();
    getRoomAlias(roomId, "forced");
    getRoomMembers(roomId, "forced");
}

function closeRoominfo() {
    $("#header_mainbutton").html('<img src="images/back.png" onclick="closeRoom()" />');
    $("#roominfo").hide();
}

function openSettings() {
    var settingshtml = '';
    settingshtml += '<div class="settingitem">matrix_user_id: ' + matrix_user_id + '</div>';
    settingshtml += '<div class="settingitem">matrix_device_id: ' + matrix_device_id + '</div>';
    settingshtml += '<div class="settingitem">matrix_access_token: ' + matrix_access_token + '</div>';
    settingshtml += `<div class="settingitem_active" onclick='settingDialog("matrix_messagelimit")'>matrix_messagelimit: ` + matrix_messagelimit + '</div>';
    settingshtml += `<div id="settingdialog"></div>`;

    $("#header_text").html("[ Settings ]");
    $("#settingsmenu").html(settingshtml);
    $("#settingsmenu").show();
    toggleSidemenu();
    $("#header_mainbutton").html('<img src="images/back.png" onclick="closeSettings()" />')
}

function closeSettings() {
    $("#header_text").html("[ " + matrix_user_id + " ]");
    $("#header_mainbutton").html('<img src="images/menu.png" onclick="toggleSidemenu()" />')
    $("#settingsmenu").hide();
}

function settingDialog(setting) {
    console.log("requesting user input for " + setting + " ..");
    var dialoghtml = '';
    var currentvalue = eval(setting);
    dialoghtml += `<input type="number" id="setting_newvalue" min="1" max="500" value="` + currentvalue + `">`;
    dialoghtml += `<button onclick='updateSetting("` + setting + `")'>Apply</button>`
    $("#settingdialog").html(dialoghtml);
    $("#settingdialog").show();
}

function updateSetting(setting) {
    console.log("updating " + setting + " ..");
    let newvalue = $("#setting_newvalue").val();
    eval(setting + ' = ' + newvalue);
    eval("localStorage." + setting + ' = ' + newvalue);
    $("#settingdialog").hide();
}

function toggleSidemenu() {
    if ($("#sidemenu").css("display") == "none") {
        $("#sidemenu").show();
    }
    else {
        $("#sidemenu").hide();
    }
}

function showLoginmenu() {
    var loginhtml = '';
    $("#header_text").html("[ Matrix Login ]");

    $('#login_password').keydown(function (event) {
        if (event.which === 13) {
            $("#login_password").blur()
            checkLogindata()
        }
    });

    $("#loginmenu").show();
    $("#header_mainbutton").html('')
}

function openCreateRoomDialog() {
    var createroomhtml = '';
    createroomhtml += `
                    <div id="input_customserver">
                        <table id="logintable">
                            <tr>
                                <td><span class="login_label">Room Name</span></td>
                                <td><input type="text" id="createroom_roomname" class="login_input" size="15" value="" /></td>
                            </tr>
                            <tr>
                                <td><span class="login_label">Visibility</span></td>
                                <td><input type="text" id="createroom_visibility" class="login_input" size="15" value="private" /></td>
                            </tr>
                        </table>
                        <div id="createroom_button" class="wbutton" onclick="createRoom()">Create</div>
                        <div id="createroom_notification"></div>
                    </div>
    `;
    $("#header_text").html("[ Create room ]");
    $("#createRoomDialog").html(createroomhtml);
    $("#createRoomDialog").show();
    toggleSidemenu();
    $("#header_mainbutton").html('<img src="images/back.png" onclick="closeCreateRoomDialog()" />')
}

function closeCreateRoomDialog() {
    $("#header_text").html("[ " + matrix_user_id + " ]");
    $("#header_mainbutton").html('<img src="images/menu.png" onclick="toggleSidemenu()" />')
    $("#createRoomDialog").hide();
}

function createRoom() {
    var preset;
    let newRoomname = $("#createroom_roomname").val();
    let newVisibility = $("#createroom_visibility").val();

    $("#createroom_notification").html("")
    if (newRoomname == "") {
        $("#createroom_notification").html("Room name cannot be empty")
        return;
    }
    if (newVisibility == "") {
        $("#createroom_notification").html("Visibility cannot be empty")
        return;
    }
    newRoomalias = newRoomname.replace(/ /g, "_").toLowerCase();

    if (newVisibility == "private") {
        preset = "private_chat";
    }
    else if (newVisibility == "public") {
        preset = "public_chat";
    }
    else {
        $("#createroom_notification").html("Visibility can only be public or private")
        return;
    }

    let query = serverurl + "/_matrix/client/r0/createRoom?access_token=" + matrix_access_token;
    $("#activityicon").show();

    $.ajax({
        url: query,
        type: 'POST',
        data: JSON.stringify({
            "name": newRoomname,
            "preset": preset,
            "room_alias_name": newRoomalias
        }),
        dataType: 'json',
        success(response) {
            $("#activityicon").hide();
            console.log(response);
            getRoomlist();
            closeCreateRoomDialog();
        },
        error(jqXHR, status, errorThrown) {
            console.log('failed to fetch ' + query)
            console.log(status);
            $("#activityicon").hide();
        },
    });
}

function showOnlinestate(status) {
    return;
}

function onBackPressed(event) {
    if ($('#settingdialog:visible').length > 0) {
        $("#settingdialog").hide();
        event.handled = true;
    }
    else if ($('#roominfo:visible').length > 0) {
        closeRoominfo();
        event.handled = true;
    }
    else if ($('#room:visible').length > 0) {
        closeRoom();
        event.handled = true;
    }
    else if ($('#settingsmenu:visible').length > 0) {
        closeSettings();
        event.handled = true;
    }
    else if ($('#createRoomDialog:visible').length > 0) {
        closeCreateRoomDialog();
        event.handled = true;
    }
    else if ($('#sidemenu:visible').length > 0) {
        toggleSidemenu();
        event.handled = true;
    }
}

function TimerRun() {
    if (currentRoomId != "" && sendingMessage == 0) {
        getRoomMessages(currentRoomId);
        console.log(`Checking for updates in "` + currentRoomName + `"`);
    }
    if (enableClientsync == 1) {
        syncClient(nextBatch);
    }
}

$(document).ready(function () {
    try {
        Windows.UI.Core.SystemNavigationManager.getForCurrentView().addEventListener("backrequested", onBackPressed);
        appVersion = Windows.ApplicationModel.Package.current.id.version;
        appString = `v${appVersion.major}.${appVersion.minor}.${appVersion.build}`;
        $("#version").html("&nbsp;" + appString);
    }
    catch (e) {
        console.log('Windows namespace not available, backbutton listener and versioninfo skipped.')
        appString = '';
    }

    window.addEventListener('online', () => showOnlinestate("online"));
    window.addEventListener('offline', () => showOnlinestate("offline"));

    document.onselectstart = new Function("return false")

    loadSettings();
    checkLoginstate();

    let zoomScale = 1;
    let lastTouchDist = 0;
    let isPanning = false;
    let startX = 0, startY = 0;
    let translateX = 0, translateY = 0;
    let lastTranslateX = 0, lastTranslateY = 0;
    let overlayDragged = false;

    function showFullScreen(url) {
        if (!url) return;
        zoomScale = 1;
        translateX = 0;
        translateY = 0;
        lastTranslateX = 0;
        lastTranslateY = 0;
        overlayDragged = false;
        updateImageTransform();
        $("#full-screen-image").attr("src", url);
        $("#full-screen-overlay").css("display", "flex");
    }

    function closeFullScreen() {
        $("#full-screen-overlay").hide();
        $("#full-screen-image").attr("src", "");
    }

    function updateImageTransform() {
        $("#full-screen-image").css("transform", `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`);
    }

    const overlay = document.getElementById("full-screen-overlay");
    const img = document.getElementById("full-screen-image");

    overlay.addEventListener("wheel", function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            zoomScale *= delta;
            zoomScale = Math.max(0.5, Math.min(zoomScale, 5));
            overlayDragged = true;
            updateImageTransform();
        }
    }, { passive: false });

    overlay.addEventListener("touchstart", function (e) {
        if (e.touches.length === 1) {
            isPanning = true;
            startX = e.touches[0].clientX - lastTranslateX;
            startY = e.touches[0].clientY - lastTranslateY;
            overlayDragged = false;
        } else if (e.touches.length === 2) {
            isPanning = false;
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    });

    overlay.addEventListener("touchmove", function (e) {
        if (e.touches.length === 1 && isPanning) {
            translateX = e.touches[0].clientX - startX;
            translateY = e.touches[0].clientY - startY;
            if (Math.abs(translateX - lastTranslateX) > 5 || Math.abs(translateY - lastTranslateY) > 5) {
                overlayDragged = true;
            }
            updateImageTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = dist / lastTouchDist;
            zoomScale *= delta;
            zoomScale = Math.max(0.5, Math.min(zoomScale, 5));
            lastTouchDist = dist;
            overlayDragged = true;
            updateImageTransform();
        }
    });

    overlay.addEventListener("touchend", function (e) {
        isPanning = false;
        lastTranslateX = translateX;
        lastTranslateY = translateY;

        // If it wasn't a drag/zoom, close the overlay
        if (!overlayDragged) {
            closeFullScreen();
        }
    });

    // Handle mouse panning if needed
    overlay.addEventListener("mousedown", function (e) {
        isPanning = true;
        startX = e.clientX - lastTranslateX;
        startY = e.clientY - lastTranslateY;
        overlayDragged = false;
    });

    window.addEventListener("mousemove", function (e) {
        if (isPanning && $("#full-screen-overlay").is(":visible")) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            if (Math.abs(translateX - lastTranslateX) > 5 || Math.abs(translateY - lastTranslateY) > 5) {
                overlayDragged = true;
            }
            updateImageTransform();
        }
    });

    window.addEventListener("mouseup", function (e) {
        if (isPanning) {
            isPanning = false;
            lastTranslateX = translateX;
            lastTranslateY = translateY;

            // Only close if it was a click, not a drag
            if (!overlayDragged && $(e.target).closest("#full-screen-overlay").length) {
                closeFullScreen();
            }
        }
    });

    // Remove the old onclick from HTML to use this logic exclusively
    $("#full-screen-overlay").removeAttr("onclick");

    // syncClient(nextBatch);

    // Delegate click events for images in messages
    $("#roomcontent").on("click", "img", function (e) {
        // Prevent clicking user avatars for full screen
        if ($(this).hasClass("user-avatar")) return;

        showFullScreen($(this).attr("src"));
    });
});

setInterval(TimerRun, 20000);

