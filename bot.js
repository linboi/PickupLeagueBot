var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');

const gameDays = [0, 2]; // 0 is sunday, 1 is monday etc
const signUpTime = 18;
const gameTimes = [45, 105, 799, 23, 432, 5]; // minutes from signup time to team announcement
var announcementsChannelID = 608298295202414595;


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

const bot = new Discord.Client();
bot.login(auth.token);

/* Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});*/

bot.once('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    announcementsChannel = bot.channels.get("608298295202414595");
    var ms = msToNextGame();
    setTimeout(organiseGame, 2000, gameTimes);
    logger.info(ms);
    readPlayerList();
});

bot.on('message', message => {
    // The bot will listen for messages that will start with `!`
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {			
			case 'standings':
                //message.react('🤔');
                printStandings(message.channel);
                break;
            case 'awaken':
                readPlayerList();
                break;
            case 'setAnnouncements':
                announcementsChannelID = channelID;
                channel.send('Announcements channel set!');
                break;
         }
     }
});

bot.on('messageReactionAdd', (MessageReaction, user) =>
{
    
});

function printStandings(channel)
{
    playerList.sort(compareMMR);
    var message = '```';
    var i; //this should be a foreach of some type probably
    for(i = 0; i < 20; i++)
    {
        message += ((i+1).toString().padStart(3, ' ')) + '. ' + playerList[i].namePadded 
            + playerList[i].mmr.toString().padEnd(4, ' ') 
            + ' (' + playerList[i].wins + '-' + playerList[i].losses + ')\n';
    }
    message += '```';
    channel.send(message);
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
    if(times.length > 9)
        console.error("can't schedule more than 9 games in one message");
    var emojiList = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'];
    var timespass = times;
    for(time in times)
        logger.info(times[time]);
    logger.info("gigantor memes" + announcementsChannelID);

    // KILLLLLLL ME THIS PART WAS HARD TO GET RIGHT 
    // these all return promises, the .react one doesn't give you the message back so you have to use the message from the outer scope
    var signupMessage = announcementsChannel.send("SIGN UP HERE");
    signupMessage.then( message =>{
        for(i = 0; i < times.length; i++)
            message.react(emojiList[i]);
    });

    // Now we're going to wait until it's time to read those reactions
    for(i = 0; i < times.length; i++)
    {
        
        signupMessage.then( message => {
            console.log(timespass[i]);
            announcementsChannel.send("bleh" + emojiList[i]);
            args = [message, emojiList[i], times[i]];
            setTimeout(buildMatch, (times[i]*60*1000), args);
        });
    }
}

// We read the reactions on the message which tells us what players want to play in that match
function buildMatch(args)
{
    message = args[0];
    emoji = args[1];
    time = args[2];
    // maybe I shouldn't be using this as an array, it was a collection before (which extends map)
    // maybe this would all be better as a collection.
    console.log("ghdsagjdshaf" + message.toString());
    console.log("fkfjd" + time);
    var reactions = message.reactions.array();
    console.log(message.reactions.length);
    for(var i = 0; i < reactions.length; i++)
    {
        console.log(reactions[i]);
        if(reactions[i]._emoji.name == emoji)
            announcementsChannel.send("THE BEANS ARE FOUND");
    }
    announcementsChannel.send("we the bois");
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

function compareMMR(a, b)
{
    return (a.mmr < b.mmr)?(1):(-1);
}

function compareGamesMissed(a, b)
{
    return (a.gamesMissed < b.gamesMissed)?(1):(-1);
}