var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');

const gameDays = [0, 2]; // 0 is sunday, 1 is monday etc
const signUpTime = 18;
const gameTimes = [45, 105]; // minutes from signup time to team announcement
var announcementsChannelID = 0;


// Class to represent a player
class Player 
{
    constructor(nameDisplay, nameDiscord, rolePrimary, roleSecondary, mmr=1000, wins=0, losses=0, gamesMissed=0)
    {
        this.nameDisplay = nameDisplay;
        this.nameDiscord = nameDiscord;
        this.rolePrimary = rolePrimary;
        this.roleSecondary = roleSecondary;
        this.mmr = mmr;
        this.wins = wins;
        this.losses = losses;
        this.gamesMissed = gamesMissed;
        this.namePadded = nameDisplay.padEnd(30, ' ');
    }
}

// Global player list
var playerList = [];

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    var ms = msToNextGame();
    setTimeout(organiseGame, 5000, gameTimes);
    logger.info(ms);
    readPlayerList();
});

bot.on('message', function (user, userID, channelID, message, evt) {
    // The bot will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong! @' + channelID + ' ' + message + ' ' + evt
                });
                break;
			
			case 'standings':
                printStandings(channelID);
                break;
            case 'awaken':
                readPlayerList();
                bot.sendMessage({
                    to: channelID,
                    message: 'blah'
                });
                break;
            case 'setAnnouncements':
                announcementsChannelID = channelID;
                bot.sendMessage({
                    to: channelID,
                    message: 'Announcements channel set!'
                });
                break;
         }
     }
});

function printStandings(channelID)
{
    var message = '```';
    var i; //this should be a foreach of some type probably
    for(i = 0; i < 20; i++)
    {
        message += ((i+1).toString().padStart(3, ' ')) + '. ' + playerList[i].namePadded 
            + playerList[i].mmr.toString().padEnd(4, ' ') 
            + ' (' + playerList[i].wins + '-' + playerList[i].losses + ')\n';
    }
    message += '```';
    bot.sendMessage({
        to: channelID,
        message: message
    });
}

function readPlayerList()
{
    fs.readFile('players.txt', 'utf8', (err, fd) => {
        if (err) {
            if (err.code === 'ENOENT') {
            console.error('players.txt does not exist in this directory');
            return;
            }
        
            throw err;
        }
        var lines = fd.split('\n');
        for(i = 0; i < lines.length; i++)
        {
            var currentPlayerLine = lines[i].trim();
            var expr = new RegExp('(.+) ([F|T|J|M|A|S])/([F|T|J|M|A|S]) ([0-9]+) ([0-9]+)\-([0-9]+).*$');
            var result = expr.exec(currentPlayerLine);
            if(!result)
                console.error('error parsing players.txt at line ' + (i+1) + ' \"' + currentPlayerLine + '\"');
            else
            {
                temp = new Player(result[1], result[1], result[2], result[3], parseInt(result[4]), wins=parseInt(result[5]), losses=parseInt(result[6]));
                playerList.push(temp);
            }
        }
    });
}

function organiseGame(times)
{
    for(time in times)
        logger.info(times[time]);
    logger.info("gigantor memes" + announcementsChannelID);
    bot.sendMessage({
        to: announcementsChannelID,
        message: 'SIGN UP FOR GAME HERE PLEASE THANKS'
    });
}

// This whole thing is really yuck but I couldn't find out to do it properly
function msToNextGame()
{
    if(gameDays.length == 0 || gameTimes.length == 0)
        console.error("CANNOT HAVE NO GAME DAYS/TIMES");
    
    var d = new Date(); // Today's date. (lots of info in here)
    var today = d.getDay(); // The current day of the week

    var i = 0;
    if(d.getHours() >= signUpTime) // Today's games are dealt with already
        i++;

    // This finds the number of days until the next game day
    var success = false;
    while(i < 7 && !success)
    {
        for(var j = 0; j < gameDays.length && !success; j++)
        {
            if((today + i) % 7 == gameDays[j])
            {
                var daysToNextGameDay = i;
                success = true; // this is basically a double break (could find min result to avoid breaking, but this finds min first anyway)
            }
        }
        i++;
    }
    logger.info(daysToNextGameDay + " sagjhdagfhjksdf");
    var signup = new Date(d.getFullYear(), d.getMonth(), d.getDate(), signUpTime);
    return ((signup - d) + (24 * 60 * 60 * 1000 * daysToNextGameDay));
}