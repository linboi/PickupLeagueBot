var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');

const gameDays = [0, 2]; // 0 is sunday, 1 is monday etc
const signUpTime = 18;
const gameTimes = [2, 500]; // minutes from signup time to team announcement
var announcementsChannelID = 608298295202414595;

// The amount of MMR lower someone should be considered if they're on a secondary role/autofilled
const secondariesPenalty = 5;
const autofillsPenalty = 20;

// Class to represent a player
class Player 
{
    constructor(nameDisplay, discordId, rolePrimary, roleSecondary, mmr=1100, wins=0, losses=0, gamesMissed=0)
    {
        this.nameDisplay = nameDisplay;
        this.discordId = discordId;
        this.rolePrimary = rolePrimary;
        this.roleSecondary = roleSecondary;
        this.mmr = mmr;
        this.wins = wins;
        this.losses = losses;
        this.gamesMissed = gamesMissed;
        this.namePadded = nameDisplay.padEnd(30, ' ');
    }

    getMMR()
    {
        return this.mmr;
    }
}

class Team
{
    constructor()
    {
        var top = 0;
        var jung = 0;
        var mid = 0;
        var adc = 0;
        var supp = 0;
        var secondaries = 0;
        var autofills = 0;
    }

    getMMR()
    {
        var total = this.top.mmr + this.jung.mmr + this.mid.mmr + this.adc.mmr + this.supp.mmr;
        return ((total/5) - (this.secondaries*secondariesPenalty + this.autofills*autofillsPenalty));
    }

    fillTeam(player)
    {
        var placed = false;
        if(!this.top)
        {
            this.top = player;
            placed = true;
        }
        else if(!this.jung)
        {
            this.jung = player;
            placed = true;
        }
        else if(!this.mid)
        {
            this.mid = player;
            placed = true;
        }
        else if(!this.adc)
        {
            this.adc = player;
            placed = true;
        }
        else if(!this.supp)
        {
            this.supp = player;
            placed = true;
        }

        if(placed)
        {
            if(player.rolePrimary != 'F' && player.roleSecondary != 'F')
                this.autofills++;
            else if(player.rolePrimary != 'F')
                this.secondaries++;
            return 1;
        }
        return 0;
    }
}

class Match
{
    constructor(blueTeam, redTeam)
    {
        this.blueTeam = blueTeam;
        this.redTeam = redTeam;
    }

    teamsString()
    {
        var str = "BLUE TEAM: " + this.blueTeam.top.nameDisplay + ", " + this.blueTeam.jung.nameDisplay + ", " 
                + this.blueTeam.mid.nameDisplay + ", " + this.blueTeam.adc.nameDisplay + ", " + this.blueTeam.supp.nameDisplay;
        str += "\nRED TEAM: " + this.redTeam.top.nameDisplay + ", " + this.redTeam.jung.nameDisplay + ", " 
                + this.redTeam.mid.nameDisplay + ", " + this.redTeam.adc.nameDisplay + ", " + this.redTeam.supp.nameDisplay;
        return str;
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
    //setTimeout(organiseGame, 2000, gameTimes);
    logger.info(ms);
    readPlayerList();
});

bot.on('message', message => {
    // The bot will listen for messages that will start with `!`
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0].toLowerCase();
       
        args = args.splice(1);

        switch(cmd) {			
			case 'standings':
                //message.react('🤔');
                printStandings(message.channel);
                break;
            /*case 'awaken':
                readPlayerList();
                break;*/
            case 'register':
                addNewPlayer(args, message.author.id, message.channel);
                break;
            case 'setAnnouncements':
                announcementsChannelID = message.channel;
                channel.send('Announcements channel set!');
                break;
         }
     }
});

bot.on('messageReactionAdd', (MessageReaction, user) =>
{
    logger.info('' + MessageReaction);
    logger.info(user);
});

function printStandings(channel)
{
    playerList.sort(byMMR);
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

function addNewPlayer(text, id, channel){
    if(text.length < 2){
        channel.send("Error registering player. Please use the following format:\n```!register PickupLeagueBot Top/Fill```");
        return;
    }
    try{
        var roles = text[text.length - 1].split("/");
        var user = text.slice(0, text.length - 1).join(" ");
        var p = new Player(user, id, roles[0].toUpperCase(), roles[1].toUpperCase())
        playerList.push(p);
        channel.send("Player " + user + " registered!");
    } catch (err){
        channel.send("Error registering player. Please use the following format:\n```!register PickupLeagueBot Top/Fill```");
    }
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

async function organiseGame(times)
{
    if(times.length > 9)
        console.error("can't schedule more than 9 games in one message");
    var emojiList = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'];
    for(time in times)
        logger.info(times[time]);
    logger.info("gigantor memes" + announcementsChannelID);

    // KILLLLLLL ME THIS PART WAS HARD TO GET RIGHT 
    // these all return promises, the .react one doesn't give you the message back so you have to use the message from the outer scope

    announcementsChannel.send("THE BEANS ARE FOUND");
    var signupMessage = await announcementsChannel.send("SIGN UP HERE");
    console.log(signupMessage.toString());
    for(i = 0; i < times.length; i++)
        await signupMessage.react(emojiList[i]);

    // Now we're going to wait until it's time to read those reactions
    for(i = 0; i < times.length; i++)
    {
        setTimeout(buildMatch, (times[i]*3*1000), signupMessage, emojiList[i]);
    }
}

// We read the reactions on the message which tells us what players want to play in that match
async function buildMatch(message, emoji)
{
    // maybe I shouldn't be using this as an array, it was a collection before (which extends map)
    // maybe this would all be better as a collection.
    var reactions = message.reactions;
    var roundPlayerList = [];

    reactions.forEach((element) => addPlayerToRound(element, roundPlayerList, emoji));
    
    if((roundPlayerList.length % 10) >= 8)
    {
        announcementsChannel.send("Almost enough players for an extra game (need " + (10-(roundPlayerList.length % 10)) + "), waiting another 5 minutes to start");
        await setTimeout(() => {}, 5*60*1000);
        var roundPlayerList = [];
        reactions.forEach((element) => addPlayerToRound(element, roundPlayerList, emoji));
    }
    for(var i = 0; i < playerList.length; i++)
        roundPlayerList.push(playerList[i]); // This is just for testing, since I can't react to the message 30 times

    var numOfGames = Math.floor(roundPlayerList.length / 10);
    roundPlayerList.sort(byGamesMissed);
    for(var i = roundPlayerList.length - 1; i >= numOfGames * 10; i--)
    {
        roundPlayerList[i].gamesMissed++;
        roundPlayerList.pop();
    }

    if(roundPlayerList.length % 10 != 0)
        console.error( roundPlayerList.length + "SOMETHING WENT HORRIBLY WRONG");

    shuffle(roundPlayerList);
    const numOfTeams = numOfGames * 2;
    var teams = [];
    for(var i = 0; i < numOfTeams; i++)
    {
        var temp = new Team();
        temp.autofills = 0;
        temp.secondaries = 0;
        await teams.push(temp);
    }
    matchmake(roundPlayerList, teams);

    teams.sort(byMMR);

    announcementsChannel.send("We have numbers for " + (numOfGames) + " games!");
    for(var i = 0; i < numOfGames; i++)
    {
        var gameMessage = "GAME " + (i+1) + ": " + teams[i*2].getMMR() + " MMR vs " + teams[(i*2)+1].getMMR() + " MMR \n";
        //console.log(teams[i*2] + " \n " + teams[(i*2)+1])
        var thisGame = new Match(teams[i*2], teams[(i*2)+1]);
        await announcementsChannel.send(gameMessage + thisGame.teamsString() + "\n\n\n");
    }
}

function addPlayerToRound(thisReaction, list, thisGame)
{
    if(thisReaction._emoji.name == thisGame)
    {
        thisReaction.users.forEach(element => {
            var playerIndex = playerListContains(playerList, element.username);
            if(playerIndex != -1)
            {
                list.push(playerList[playerIndex]);
            }
        });
    }
}
/*  
    ----------------------------------------MATCHMAKING FUNCTIONS-------------------------------------------
    Anything to do with matchmaking goes here 
    --------------------------------------------------------------------------------------------------------
*/

function matchmake(listOfPlayers, teams)
{
    var unassignedPlayers = listOfPlayers.length;
    var fillPlayers = 0;
    while(unassignedPlayers > 0)
    {
        var currentPlayer = listOfPlayers[unassignedPlayers-1];
        if(fillPlayers < unassignedPlayers)
        {
            var success = 0
            
            success = placeInTeam(currentPlayer, teams);
            if(success)
            {
                unassignedPlayers--;
            }
            else
            {
                swap(listOfPlayers, unassignedPlayers-1, fillPlayers);
                fillPlayers++;
            }
        }
        else // At this point the rest of the players either have fill in their roles or are being autofilled.
        {
            var filledTeams = 0;
            // If it crashes from out of bounds here it means there were more than 5*teams players in the playerList
            while(!teams[filledTeams].fillTeam(currentPlayer))
                filledTeams++;

            unassignedPlayers--;
        }
    }
}

// Places the player in a team based on their primary and secondary roles. If they don't fit or they've selected fill, returns 0
function placeInTeam(player, teamList)
{
    for(var i = 0; i < teamList.length; i++)
    {
        switch(player.rolePrimary){
            case 'F':
                return 0;
            case 'T':
                if(!teamList[i].top)
                {
                    teamList[i].top = player;
                    return 1;
                }
                break;
            case 'J':
                if(!teamList[i].jung)
                {
                    teamList[i].jung = player;
                    return 1;
                }
                break;
            case 'M':
                if(!teamList[i].mid)
                {
                    teamList[i].mid = player;
                    return 1;
                }
                break;
            case 'A':
                if(!teamList[i].adc)
                {
                    teamList[i].adc = player;
                    return 1;
                }
                break;
            case 'S':
                if(!teamList[i].supp)
                {
                    teamList[i].supp = player;
                    return 1;
                }
                break;
            default:
                console.error("UNKNOWN ROLE DETECTED");
                return -1;
        }
    }

    // if we reach this point, the player's primary is already taken in all teams
    for(var i = 0; i < teamList.length; i++)
    {
        switch(player.rolePrimary){
            case 'F':
                return 0;
            case 'T':
                if(!teamList[i].top)
                {
                    teamList[i].top = player;
                    teamList.secondaries++;
                    return 1;
                }
                break;
            case 'J':
                if(!teamList[i].jung)
                {
                    teamList[i].jung = player;
                    teamList.secondaries++;
                    return 1;
                }
                break;
            case 'M':
                if(!teamList[i].mid)
                {
                    teamList[i].mid = player;
                    teamList.secondaries++;
                    return 1;
                }
                break;
            case 'A':
                if(!teamList[i].adc)
                {
                    teamList[i].adc = player;
                    teamList.secondaries++;
                    return 1;
                }
                break;
            case 'S':
                if(!teamList[i].supp)
                {
                    teamList[i].supp = player;
                    teamList.secondaries++;
                    return 1;
                }
                break;
            default:
                console.error("UNKNOWN ROLE DETECTED");
                return -1;

        }
    }
    return 0;
}

/*  
    ----------------------------------------HELPERS---------------------------------------------------------
    These functions are just small tasks to keep the code cleaner
    --------------------------------------------------------------------------------------------------------
*/

// This whole thing is really yuck but I couldn't find out to do it properly
function msToNextGame()
{
    if(gameDays.length == 0 || gameTimes.length == 0)
        console.error("CANNOT HAVE NO GAME DAYS/TIMES");
    
    var d = new Date(); // Today's date. (lots of info in here)
    var today = d.getDay(); // The current day of the week (0 is sunday, 1 is monday etc)

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
    var signup = new Date(d.getFullYear(), d.getMonth(), d.getDate(), signUpTime);
    return ((signup - d) + (24 * 60 * 60 * 1000 * daysToNextGameDay));
}

function shuffle(list)
{
    for(var i = list.length - 1; i > 0; i--)
    {
        var randInt = Math.floor(Math.random() * (i + 1));
        var temp = list[i];
        list[i] = list[randInt];
        list[randInt] = temp;
    }
}

function byMMR(a, b)
{
    return (a.getMMR() < b.getMMR())?(1):(-1);
}

function byGamesMissed(a, b)
{
    return (a.gamesMissed < b.gamesMissed)?(1):(-1);
}

// this function is very specific, maybe this part of the code could be written better
function playerListContains(listToCheck, username)
{
    var contains = -1;
    listToCheck.forEach((element, index) => 
        {
            if(element.nameDiscord == username)
                contains = index;
        });
    return contains;
}

function swap(list, i, j)
{
    var temp = list[i];
    list[i] = list[j];
    list[j] = temp;
}

// -----------------------------------------END HELPERS---------------------------------------------------------
