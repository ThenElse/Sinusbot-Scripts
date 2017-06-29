registerPlugin({
    name: 'Lyrics',
    version: '0.0.1',
    engine: '>= 0.9.17',
    description: 'Search Lyrics from makeitpersonal.co',
    author: 'NT5',
    vars: []
}, function (sinusbot, config) {

    var backend = require('backend');
    var engine = require('engine');
    var event = require('event');

    // String format util
    if (!String.prototype.format) {
        String.prototype.format = function () {
            var str = this.toString();
            if (!arguments.length) {
                return str;
            }
            var args = typeof arguments[0];
            args = (("string" === args || "number" === args) ? arguments : arguments[0]);
            for (var arg in args) {
                str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
            }
            return str;
        }
    }

    // Polyfill util https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill
    if (typeof Object.assign !== 'function') {
        Object.assign = function (target, varArgs) { // .length of function is 2
            'use strict';
            if (target === null) { // TypeError if undefined or null
                throw new TypeError('Cannot convert undefined or null to object');
            }

            var to = Object(target);

            for (var index = 1; index < arguments.length; index++) {
                var nextSource = arguments[index];

                if (nextSource !== null) { // Skip over if undefined or null
                    for (var nextKey in nextSource) {
                        // Avoid bugs when hasOwnProperty is shadowed
                        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        };
    }

    // String truncate util http://stackoverflow.com/questions/1199352
    String.prototype.trunc = function (n, useWordBoundary) {
        if (this.length <= n) { return this; }
        var subString = this.substr(0, n - 1);
        return (useWordBoundary
                ? subString.substr(0, subString.lastIndexOf(' '))
                : subString) + "...";
    };

    var app = {
        util: {
            seconds_to_human: function (seconds) {
                var years = Math.floor(seconds / 31536000);
                seconds = Math.floor(seconds - 31536000 * years);
                var months = Math.floor(seconds / 2628000);
                seconds = Math.floor(seconds - 2628000 * months);
                var weeks = Math.floor(seconds / 604800);
                seconds = Math.floor(seconds - 604800 * weeks);
                var days = Math.floor(seconds / 86400);
                seconds = Math.floor(seconds - 86400 * days);
                var hours = Math.floor(seconds / 3600);
                seconds = Math.floor(seconds - 3600 * hours);
                var minutes = Math.floor(seconds / 60);
                seconds = Math.floor(seconds - 60 * minutes);

                var messages = [];

                if (years > 0)
                    messages.push("{0}years".format(years));
                if (months > 0)
                    messages.push("{0}months".format(months));
                if (weeks > 0)
                    messages.push("{0}weeks".format(weeks));
                if (days > 0)
                    messages.push("{0}days".format(days));
                if (hours > 0)
                    messages.push("{0}hrs".format(hours));
                if (minutes > 0)
                    messages.push("{0}min".format(minutes));
                if (seconds > 0)
                    messages.push("{0}secs".format(seconds))

                return (messages.length > 0 ? messages.join(", ") : "{0}secs".format(seconds));
            }
        },
        config: {
            plugin: {
                manifest: {
                    running_time: Math.floor(Date.now() / 1000),
                    version: '0.0.1',
                    authors: [
                        {
                            name: 'NT5',
                            role: 'Main Dev'
                        }
                    ]
                },
                regex: {
                    // !{command}[-{area}] [{text}]
                    command: /^!(\w+)(?:-(\w+))?(?:\s(.+))?/,
                    // {artist} - {title}
                    lyrics_search: /(.+)(?:\s-\s)(.+)/
                },
                command_trigger: 'lyrics'
            },
            api: {
                makeitpersonal: {
                    url: 'http://makeitpersonal.co/lyrics?artist={artist}&title={title}'
                }
            }
        },
        getJSON: function (options) {
            options = (typeof options !== "object") ? {} : options;

            options.method = options.method || 'GET';
            options.parse = options.parse;
            options.url = options.url || '';
            options.headers = options.headers || { 'Content-Type': 'application/json; charset=UTF-8' };
            options.callback = options.callback || function (err, res) { engine.log(res); };
            options.error_callback = options.error_callback || function (err, res) { engine.log(err); };

            /*
             TODO
              - [ENH] Port to new script engine
            */
            sinusbot.http({
                method: options.method,
                url: options.url,
                headers: options.headers
            }, function (err, res) {
                if (err || res.statusCode !== 200) {
                    engine.log('Request error [{error}] Code: [{code}] Data: [{data}]'.format({
                        error: err,
                        data: res.data,
                        code: res.statusCode
                    }));
                    options.error_callback(err);
                } else {
                    if (options.parse) {
                        var json = JSON.parse(res.data);
                        options.callback(json);
                    } else {
                        options.callback(res.data);
                    }
                }
            });
        },
        api: {
            makeitpersonal: {
                getLyric: function (options) {
                    options = (typeof options !== "object") ? {} : options;

                    options.artist = options.artist || 'Daft Punk';
                    options.title = options.title || 'Around The World';
                    options.callback = options.callback || function (err, res) { engine.log(res); };
                    options.error_callback = options.error_callback || function (err, res) { engine.log(err); };

                    app.getJSON({
                        url: app.config.api.makeitpersonal.url.format({
                            artist: options.artist.replace(/ /g, '+'),
                            title: options.title.replace(/ /g, '+')
                        }),
                        parse: false,
                        callback: options.callback,
                        error_callback: options.error_callback
                    });
                }
            }
        },
        msg: function (options) {
            options = (typeof options !== "object") ? {} : options;

            options.text = options.text || 'ravioli ravioli';
            options.mode = options.mode || 0;
            options.backend = options.backend || backend;
            options.client = options.client || false;
            options.channel = options.channel || options.backend.getCurrentChannel();

            var maxlength = 800;
            var timeoutdelay = 125;

            /*
             TODO
             - [BUG] Make sure if works in all cases
            */
            switch (options.mode) {
                case 1: // Private client message
                    if (options.client) {
                        if (options.text.length >= maxlength) {
                            options.client.chat(options.text.trunc(maxlength));
                            options.text = options.text.slice(maxlength, options.text.length);
                            setTimeout(function () {
                                app.msg(options)
                            }, timeoutdelay);
                        } else {
                            options.client.chat(options.text);
                        }
                    } else {
                        options.mode = 0;
                        app.msg(options);
                    }
                    break;
                case 2: // Channel message
                    if (options.channel) {
                        if (options.text.length > maxlength) {
                            options.channel.chat(options.text.trunc(maxlength));
                            options.text = options.text.slice(maxlength, options.text.length);
                            setTimeout(function () {
                                app.msg(options)
                            }, timeoutdelay);
                        } else {
                            options.channel.chat(options.text);
                        }
                    } else {
                        options.mode = 0;
                        app.msg(options);
                    }
                    break;
                default: // Server message
                    if (options.text.length > maxlength) {
                        options.backend.chat(options.text.trunc(maxlength));
                        options.text = options.text.slice(maxlength, options.text.length);
                        setTimeout(function () {
                            app.msg(options)
                        }, timeoutdelay);
                    } else {
                        options.backend.chat(options.text);
                    }
                    break;
            }
        },
        commands: {
            'lyrics': {
                syntax: '!{cmd}-[{valids}] {artits} - {song name}',
                active: true,
                hidden: true,
                callback: function (data) {
                    data = (typeof data !== "object") ? {} : data;

                    var msg = function (message) {
                        app.msg({
                            mode: data.mode,
                            client: data.client,
                            channel: data.channel,
                            text: message
                        });
                    };

                    var artist, title, text;
                    if ((text = app.config.plugin.regex.lyrics_search.exec(data.text)) !== null) {
                        artist = text[1];
                        title = text[2];

                        app.api.makeitpersonal.getLyric({
                            artist: artist,
                            title: title,
                            callback: msg,
                            error_callback: msg
                        });
                    } else {
                        msg('Invalid Format. !lyrics {artits} - {song name}');
                    }
                }
            },
            'about': {
                syntax: false,
                active: true,
                hidden: false,
                admin: false,
                callback: function (data) {
                    var bot = backend.getBotClient();

                    var authors = (function () {
                        var text = [];
                        app.config.plugin.manifest.authors.forEach(function (author) {
                            text.push('{name} [{role}]'.format({
                                name: author.name,
                                role: author.role
                            }));
                        });
                        return text.join(', ');
                    });

                    app.msg(Object.assign(data, {
                        text: 'Lyrics script v{version} by {authors} running on {bot_name} for {running_time} powered by makeitpersonal.co'.format({
                            version: app.config.plugin.manifest.version,
                            authors: authors,
                            bot_name: bot.name(),
                            running_time: app.util.seconds_to_human(Math.floor(Date.now() / 1000) - app.config.plugin.manifest.running_time)
                        })
                    }));
                }
            },
            getCommands: (function () {
                var commands = [];
                Object.keys(app.commands).forEach(function (key) {
                    var command = app.commands[key];
                    if (command.active && !command.hidden) {
                        commands.push(key);
                    }
                });
                return commands || false;
            })
        },
        callbacks: {
        }
    };

    event.on('track', function (track) {
        if (track.type() !== 'temp') {
            app.api.makeitpersonal.getLyric({
                artist: track.artist(),
                title: track.title(),
                callback: function (lyrics) {
                    app.msg({
                        mode: 2,
                        text: lyrics
                    });
                },
            });
        }
    });

    event.on('chat', function (ev) {
        var client = ev.client;
        var channel = ev.channel;
        var bot = backend.getBotClient();

        if (client.isSelf()) return;

        var cmd, par, text;
        // Regex text: !{command}[-{area}] {text}
        if ((text = app.config.plugin.regex.command.exec(ev.text)) !== null) {
            cmd = text[1].toLowerCase(); // Command trigger
            par = text[2]; // Command area
            text = text[3]; // Args

            var main_cmd = app.commands['lyrics'];
            var msg = {
                mode: ev.mode,
                client: client,
                channel: channel
            };

            // Chat command equals to command trigger
            if (cmd === app.config.plugin.command_trigger.toLocaleLowerCase()) {
                // If have a sub-command
                if (par) {
                    par = par.toLocaleLowerCase();
                    // Sub-command exists on script
                    if (par in app.commands && par !== 'qinfo') {
                        // Command have a callback function
                        if ('callback' in app.commands[par] && typeof app.commands[par].callback === 'function') {
                            var command = app.commands[par];

                            // Command is turned off
                            if (!command.active) {
                                engine.log('{command} command is turned off and can\'t execute'.format({
                                    command: par
                                }));
                                return;
                            }

                            // If the command have a syntax to work
                            if (command.syntax) {
                                // Check if chat have text
                                if (text) {
                                    command.callback(Object.assign({
                                        text: text
                                    }, msg));
                                    // No text pass return command syntax
                                } else {
                                    app.msg(Object.assign({
                                        text: command.syntax.format({
                                            cmd: cmd,
                                            par: par,
                                            botname: bot.name()
                                        })
                                    }, msg));
                                }
                                // No syntax needed trigger commmand
                            } else {
                                command.callback(msg);
                            }
                            // Send message if not valid callback found
                        } else {
                            app.msg(Object.assign(msg, {
                                mode: 1,
                                text: 'Invalid command !{cmd}-{par} not have a valid callback'.format({
                                    cmd: cmd,
                                    par: par
                                })
                            }));
                        }
                        // Sub-command not exists, send valid list
                    } else {
                        app.msg(Object.assign(msg, {
                            text: 'Invalid command !{cmd}-{par}. Valid commands: !{cmd}-[{valids}]'.format({
                                cmd: cmd,
                                par: par,
                                valids: app.commands.getCommands
                            })
                        }));
                    }
                } else if (text) {
                    // Trigger search {text}
                    main_cmd.callback(Object.assign({
                        text: text
                    }, msg));
                } else {
                    app.msg(Object.assign({
                        text: main_cmd.syntax.format({
                            cmd: cmd,
                            valids: app.commands.getCommands
                        })
                    }, msg));
                }
            }
        }
    });
});