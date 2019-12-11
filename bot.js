var Discord = require('discord.js');
var auth = require('./auth.json');
var fs = require('fs');

// -----CONSTANTS-----

const VERSION = '1.4.2';
const gameDays = [1, 3]; // 0 is sunday, 1 is monday etc
const signUpTime = 20;
const gameTimes = [50, 110] // minutes from signup time to team announcement
const adminList = ["225650967058710529", "91114718902636544"];
const channelsToListenIn = ["628952731310358528", "591003151176564746", "608298295202414595"];
const TEAM_SIZE = 5; // the number of players on a team
const NUM_TEAMS = 2; // the number of teams in one game

// The amount of MMR lower someone should be considered if they're on a secondary role/autofilled
const secondariesPenalty = 5;
const autofillsPenalty = 20;

// -----GLOBALS-----
// Global player list
var playerList = [];

var activeGames = [];
var activeCheckinMessages = [];

var importantDebugInfo = 0;
// Class to represent a player
class Player 
{
    constructor(nameDisplay, discordId, rolePrimary, roleSecondary, mmr=1200, wins=0, losses=0, gamesMissed=0, kFactor=80, trueID="")
    {
        this.nameDisplay = nameDisplay;
        this.discordId = discordId;
        this.rolePrimary = rolePrimary;
        this.roleSecondary = roleSecondary;
        this.mmr = mmr;
        this.wins = wins;
        this.losses = losses;
        this.gamesMissed = gamesMissed;
        this.namePadded = nameDisplay.padEnd(23, ' ');
        this.kFactor = kFactor;
    }

    getMMR()
    {
        return this.mmr;
    }

    getMMRinPos(pos)
    {
        if(pos == this.rolePrimary)
        {
            return this.mmr;
        }
        else if(pos == this.roleSecondary)
        {
            return this.mmr - secondariesPenalty;
        }
        else
        {
            return this.mmr - autofillsPenalty;
        }
    }
}

class Team
{
    constructor(top=0, jung=0, mid=0, adc=0, supp=0)
    {
        this.top = top;
        this.jung = jung;
        this.mid = mid;
        this.adc = adc;
        this.supp = supp;
        this.secondaries = 0;
        this.autofills = 0;
    }

    getMMR()
    {
        var total = this.top.getMMRinPos("T") + this.jung.getMMRinPos("J") + this.mid.getMMRinPos("M") + this.adc.getMMRinPos("A") + this.supp.getMMRinPos("S");
        return total;
    }

    toArray()
    {
        return [this.top, this.jung, this.mid, this.adc, this.supp];
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
    constructor(blueTeam, redTeam, sparePlayers)
    {
        this.blueTeam = blueTeam;
        this.redTeam = redTeam;
        this.sparePlayers = sparePlayers;
    }

    teamsString()
    {
        var str = "BLUE TEAM: " + this.blueTeam.top.nameDisplay + ", " + this.blueTeam.jung.nameDisplay + ", " 
                + this.blueTeam.mid.nameDisplay + ", " + this.blueTeam.adc.nameDisplay + ", " + this.blueTeam.supp.nameDisplay;
        str += "\nRED TEAM: " + this.redTeam.top.nameDisplay + ", " + this.redTeam.jung.nameDisplay + ", " 
                + this.redTeam.mid.nameDisplay + ", " + this.redTeam.adc.nameDisplay + ", " + this.redTeam.supp.nameDisplay;
        return str;
    }

    // Returns -1 if player is not in this match, returns 1 if they're on blue team, 2 if they're on red team
    matchContainsPlayer(id)
    {
        var blueArray = this.blueTeam.toArray();
        var redArray = this.redTeam.toArray();
        for(var i = 0; i < blueArray.length; i++)
        {
            if(blueArray[i].trueID == id)
                return 1;
        }
        for(var i = 0; i < redArray.length; i++)
        {
            if(redArray[i].trueID == id)
                return 2;
        }
        return -1;
    }

    replacePlayer(id, team, replacement)
    {
        if(team == 1)
        {
            switch(id)
            {
                case this.blueTeam.top.trueID:
                    this.blueTeam.top = replacement;
                    return 1;
                case this.blueTeam.jung.trueID:
                    this.blueTeam.jung = replacement;
                    return 1;
                case this.blueTeam.mid.trueID:
                    this.blueTeam.mid = replacement;
                    return 1;
                case this.blueTeam.adc.trueID:
                    this.blueTeam.adc = replacement;
                    return 1;
                case this.blueTeam.supp.trueID:
                    this.blueTeam.supp = replacement;
                    return 1;
            }
        }
        else if(team == 2)
        {
            switch(id)
            {
                case this.redTeam.top.trueID:
                    this.redTeam.top = replacement;
                    return 1;
                case this.redTeam.jung.trueID:
                    this.redTeam.jung = replacement;
                    return 1;
                case this.redTeam.mid.trueID:
                    this.redTeam.mid = replacement;
                    return 1;
                case this.redTeam.adc.trueID:
                    this.redTeam.adc = replacement;
                    return 1;
                case this.redTeam.supp.trueID:
                    this.redTeam.supp = replacement;
                    return 1;
            }
        }
        console.error("This should be unreachable");
    }
}

const bot = new Discord.Client();
bot.login(auth.token);

bot.once('ready', function (evt) {
    readPlayerList('players.txt');
    announcementsChannel = bot.channels.get("591003151176564746");
    importantDebugInfo = bot.users.get("225650967058710529");
    console.log("Bot connected. Version: " + VERSION);
    importantDebugInfo.send("Bot connected. Version: " + VERSION);
    var ms = msToNextGame();
    console.log(ms);

    setTimeout(organiseGameTime, ms, gameTimes);
    //repeatedlyStartGames(); // This starts a recursive function which will start a game at the next game time, then call itself.
});

function byID(a, b){
    return (parseInt(a.discordId) > parseInt(b.discordId))?(1):(-1);
}

bot.on('message', message => {
    var isInListeningChannel = false;
    channelsToListenIn.forEach(element => {
        if(element == message.channel.id)
            isInListeningChannel = true;
    });
    if(!isInListeningChannel)
        return;
    // The bot will listen for messages that will start with `!`, '!admin' is a specially treated case
    if(message.content.substring(0, 6) == '!admin')
    {
        var isAdmin = false;
        adminList.forEach(element => {
            if(message.author.id == element)
                isAdmin = true;
        });
        if(!isAdmin)
        {
            message.channel.send("User is not an admin.");
            return;
        }
        var expr = new RegExp('!admin (.+)');
        var exprWithArgs = new RegExp('!admin (.+) \'(.+)\'');
        var result = exprWithArgs.exec(message.content);
        if(!result)
            result = expr.exec(message.content);
        console.log(result);
        if(!result || !result[1])
        {
            message.channel.send("Badly formed command");
            return;
        }
        var cmd = result[1];
        if(result[2])
        {
            var args = result[2];
        }
        switch(cmd)
        {
            case 'inputresult':
                manualResult(message.channel, args);
                break;
            case 'write':
                writePlayerList();
                break;
            case 'revert':
                playerList = [];
                readPlayerList(args);
                break;
            case 'printplayer':
                adminPrintPlayer(message.channel, args);
                break;
            case 'losspreventedwin':
                fakeResult(message.channel, args, 1);
                break;
            case 'losspreventedloss':
                fakeResult(message.channel, args, 0);
                break;
            case 'addmissed':
                addMissedGames(message.channel, args);
                break;
            case 'softreset':
                softReset(message.channel, args);
                break;
            default:
                message.channel.send("Unrecognised admin command");

        }
    }
    else if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0].toLowerCase();
       
        args = args.splice(1);

        switch(cmd) {			
			case 'standings':
                printPersonalStandings(message.channel, message.author.id);
                break;
            case 'fullstandings':
                printStandings(message.channel, args[0]);
                break;
            case 'roles':
            case 'register':
                addNewPlayer(args, message.author.id, message.channel);
                break;
            case 'win':
                resolveMatch(message.channel, message.author.id);
                break;
            case 'missing':
                missingPlayer(message.channel, args);
                break;
            case 'replace':
                missingPlayer(message.channel, args, true);
                break;
            case 'version':
                message.channel.send("Bot running version: " + VERSION);
                break;
            case 'fixid':
                fixDiscID(message.author.id);
                break;
         }
     }
});

function fixDiscID(id)
{
    playerList.forEach(element => {
        if(element.discordId.substring(0, 15) == id.substring(0, 15))
            element.trueID = id;
    });
}

function softReset(channel, args)
{
    args = args.split("'");
    if(!args[0] || !args[1])
    {
        channel.send("Bad arguments");
    }
    var newKFactor = parseInt(args[0]);
    var mmrRatio = parseFloat(args[1]);
    playerList.forEach(element => {
        element.mmr = element.mmr + mmrRatio*(1200 - element.mmr);
        element.wins = 0;
        element.losses = 0;
        element.kFactor = newKFactor;
    });
}

function adminPrintPlayer(channel, player)
{
    var found = false;
    playerList.forEach(element => {
        if(element.nameDisplay == player)
        {
            channel.send("Name: " + element.nameDisplay + " ID: " + element.discordId + " MMR: " + element.mmr + " kFactor: " + element.kFactor + " trueID: " + element.trueID + " games missed: " + element.gamesMissed);
            if(element.trueID)
            {
                if(bot.users.get(element.trueID).bot)
                {
                    channel.send("user is a bot");
                }
                else
                {
                    channel.send("user is not a bot");
                }
            }
            found = true;
        }
    });
    if(!found)
        channel.send("Player " + player + " not found");
}

function addMissedGames(channel, args)
{
    args = args.split("'");
    var amount = 0;
    if(!args[0] || !args[1])
    {
        channel.send("Invalid arguments");
        return;
    }
    else
    {
        amount = parseInt(args[1]);
    }
    playerList.forEach(element => {
        if(element.nameDisplay == args[0])
        {
            console.log(amount);
            element.gamesMissed += amount;
            found = true;
            return;
        }
    });
    if(!found)
    {
        channel.send("player not found");
    }
}

bot.on('messageReactionAdd', (MessageReaction, user) =>
{
    if(user.bot == true)
    {
        importantDebugInfo.send("bot reacted to message");
        return 1;
    }
    activeCheckinMessages.forEach((element) => {
        if(element.id == MessageReaction.message.id)
        {
            var playerIsRegistered = false;
            playerList.forEach(element => {
                if((element.discordId.substring(0, 15) == user.id.substring(0, 15)) || element.trueID == user.id)
                {
                    playerIsRegistered = true;
                    if(!element.trueID)
                    {
                        element.trueID = user.id;
                    }
                }
            });
            if(!playerIsRegistered)
            {
                MessageReaction.remove(user);
                user.send("You must register using '!register [summonername] [primaryrole]/[secondaryrole]' before you can check-in to a game.\n" +
                "**Your check-in has been removed, please check in again after registering**");
            }
        }
    });
});

function fakeResult(channel, players, win)
{
    players = players.split("'");
    var playerObjects = [];
    players.forEach(element => {
        var found = false;
        playerList.forEach(regPlayer => {
            if(regPlayer.nameDisplay == element)
            {
                found = true;
                playerObjects.push(regPlayer);
                return;
            }
        });
        if(!found)
            channel.send("Failed to find player " + element);
    });

    playerObjects.forEach(element => {
        if(win == 1)
        {
            element.wins++;
            element.mmr = element.mmr + (element.kFactor*0.4);
        }
        else
        {
            element.losses++;
            element.mmr = element.mmr - (element.kFactor*0.5);
        }
        
    })
}

function repeatedlyStartGames()
{
    var ms = msToNextGame();
    setTimeout(organiseGameTime, ms, gameTimes);
    setTimeout(repeatedlyStartGames, (ms + 20000));
}

function printStandings(channel, page)
{
    if(!page)
        page = 1;
    playerList.sort(byMMR);
    var message = '```';
    for(var i = (0+20*(page-1)); i < (20 + 20*(page-1)) && i < playerList.length; i++)
    {
        var intMMR = Math.trunc(playerList[i].mmr);
        message += ((i+1).toString().padStart(3, ' ')) + '. ' + playerList[i].namePadded 
            + intMMR.toString().padEnd(4, ' ') 
            + ' (' + playerList[i].wins + '-' + playerList[i].losses + ')\n';
    }
    message += '```';
    channel.send(message);
}

function printPersonalStandings(channel, id)
{
    var foundAt = -1;
    playerList.sort(byMMR);
    playerList.forEach((element, index) =>{
        if(element.discordId.substring(0, 15) == id.substring(0, 15))
        {
            foundAt = index;
            if(!element.trueID)
                element.trueID = id;
        }
    });
    if(foundAt < 10)
        printStandings(channel, 1);
    else
    {
        var message = '```';
        for(var i = 0; i < 5 && i < playerList.length; i++)
        {
            var intMMR = Math.trunc(playerList[i].mmr);
            message += ((i+1).toString().padStart(3, ' ')) + '. ' + playerList[i].namePadded 
                + intMMR.toString().padEnd(4, ' ') 
                + ' (' + playerList[i].wins + '-' + playerList[i].losses + ')\n';
        }
        message += '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n'/*=======================================\n*/+'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv\n';
        for(var i = foundAt-5; i <= foundAt+5 && i < playerList.length; i++)
        {
            if(i == foundAt)
                message += '---------------------------------------\n';
            var intMMR = Math.trunc(playerList[i].mmr);
            message += ((i+1).toString().padStart(3, ' ')) + '. ' + playerList[i].namePadded 
                + intMMR.toString().padEnd(4, ' ') 
                + ' (' + playerList[i].wins + '-' + playerList[i].losses + ')\n';
            if(i == foundAt)
                message += '---------------------------------------\n';
        }
        message += '```';
        channel.send(message);
    }
}

function readPlayerList(filename)
{
    console.log(filename);
    fs.readFile(filename, 'utf8', (err, fd) => {
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
            var expr = new RegExp('(.+) ([0-9]+) ([F|T|J|M|A|S])/([F|T|J|M|A|S]) ([0-9]+\.?[0-9]*) ([0-9]+)\-([0-9]+) ([0-9]+) ([0-9]+\.?[0-9]*) ?([0-9]+)?.*$');
            var result = expr.exec(currentPlayerLine);
            if(!result)
            {
                if(currentPlayerLine != "")
                    console.error('error parsing players.txt at line ' + (i+1) + ' \"' + currentPlayerLine + '\"');
            }
            else
            {
                temp = new Player(result[1], result[2], result[3], result[4], parseFloat(result[5]), wins=parseInt(result[6]), losses=parseInt(result[7]),
                                    gamesMissed=parseInt(result[8]), kFactor=parseFloat(result[9]));
                if(result[10])
                    temp.trueID = result[10];
                else
                    temp.trueID = "";
                playerList.push(temp);
            }
        }
    });
    console.log("done");
}

function writePlayerList()
{
    var fileContents = "";
    for(var i = 0; i < playerList.length; i++)
    {
        fileContents += playerList[i].nameDisplay + " " +
                        playerList[i].discordId + " " +
                        playerList[i].rolePrimary + "/" +
                        playerList[i].roleSecondary + " " +
                        playerList[i].mmr + " " +
                        playerList[i].wins + "-" +
                        playerList[i].losses + " " +
                        playerList[i].gamesMissed + " " +
                        playerList[i].kFactor + " " +
                        playerList[i].trueID + "\n";
    }
    fs.writeFile('players.txt', fileContents, (err, fd) => {
        if(err)
            console.error("Error while writing file Players.txt\n" + err);
    });
}

function addNewPlayer(text, id, channel){
    text = text.join(" ");
    var expr = new RegExp('(.+) (.+)/(.+)'); // (^[0-9\\p{L} _\\.]+) < riot say this is RegExp for a valid summoner name but it didn't work for me
    var result = expr.exec(text);
    if(!result)
        channel.send("Error registering player. Please use the following format:\n```!register summonerName primary/secondary```");
    else
    {
        var alreadyRegistered = false;
        var regPlayer;
        playerList.forEach(element => {
            if(element.discordId.substring(0, 15) == id.substring(0, 15))
            {
                alreadyRegistered = true;
                channel.send("Player already registered, updating roles and IGN.");
                regPlayer = element;
            }
        });
        var summonerName = result[1];
        if(result[2].substring(0, 3).toUpperCase() == "MAR" || result[2].substring(0, 3).toUpperCase() == "BOT")
            result[2] = 'A';
        if(result[3].substring(0, 3).toUpperCase() == "MAR" || result[3].substring(0, 3).toUpperCase() == "BOT")
            result[3] = 'A';
        var pRole = result[2].substring(0, 1).toUpperCase();
        var sRole = result[3].substring(0, 1).toUpperCase();
        var roleExpr = new RegExp('[TJMASF]');
        var errorCheck = roleExpr.exec(pRole);
        if(!errorCheck)
        {
            channel.send("Invalid primary role selection");
            return 0;
        } 
        errorCheck = roleExpr.exec(sRole);
        if(!errorCheck)
        {
            channel.send("Invalid secondary role selection");
            return 0;
        }
        if(alreadyRegistered)
        {
            regPlayer.nameDisplay = summonerName;
            regPlayer.rolePrimary = pRole; 
            regPlayer.roleSecondary = sRole;
            regPlayer.trueID = id;
            regPlayer.namePadded = regPlayer.nameDisplay.padEnd(23, ' ');
            writePlayerList()
            return 1;
        }
        else
        {
            maxGamesMissed = 0;
            playerList.forEach(element => {
                if(element.gamesMissed > maxGamesMissed)
                    maxGamesMissed = element.gamesMissed;
            });
            var p = new Player(summonerName, id, pRole, sRole);
            p.gamesMissed = maxGamesMissed;
            p.trueID = id;
            playerList.push(p);
            channel.send("Player " + summonerName + " registered!");
            writePlayerList();
            return 1;
        }
    }
}

function missingPlayer(channel, playerName, includeReplacement=false)
{
    var replacement = 0;
    playerName = playerName.join(" ");
    if(includeReplacement)
    {
        // split the player name into the missing player and the replacement
        var missAndReplace = playerName.split(",");
        if(!missAndReplace[1] || !missAndReplace[0])
        {
            channel.send("Bad arguments");
            return;
        }
        playerName = missAndReplace[0].trim();
        replacementName = missAndReplace[1].trim();
        console.log(playerName + " and " + replacementName);
        var found = false;
        playerList.forEach(element => {
            if(element.nameDisplay == replacementName)
            {
                replacement = element;
                if(!element.trueID)
                    channel.send("Replacement please use !fixID");
                else
                    found = true;
            }
        });
        if(!found)
        {
            channel.send("Player " + replacementName + " not found in registered list");
            return;
        }
    }
    var missingPlayer = 0;
    playerList.forEach(element => {
        if(element.nameDisplay == playerName)
            missingPlayer = element;
    });
    if(missingPlayer == 0)
        channel.send("No registered player with summoner name " + playerName + " found.");
    else
    {
        var success = false;
        activeGames.forEach(element => {
            var team = element.matchContainsPlayer(missingPlayer.trueID);
            if(team != -1)
            {
                if(element.sparePlayers.length < 1 && !includeReplacement)
                {
                    channel.send("No extra players signed up to replace missing player");
                    success = true;
                    return 0;
                }
                else
                {
                    if(!includeReplacement)
                        replacement = element.sparePlayers.pop();
                    element.replacePlayer(missingPlayer.trueID, team, replacement);
                    channel.send("Replaced missing player with " + replacement.nameDisplay + "\n" + 
                                "Game is now -\n" + element.teamsString());
                    success = true;
                }
            }
        });
        if(!success)
            channel.send("Player " + playerName + " is not in an active game.");
    }
    return 0;
}

async function organiseGameTime(times)
{
    if(times.length > 9)
        console.error("can't schedule more than 9 games in one message");
    var emojiList = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'];

    
    var signupMessageText = "Check in for registered players\nReact with the corresponding number to check in for a game\n";
    for(var i = 0; i < times.length; i++)
    {
        signupMessageText += "Game " + (i+1) + ": in " + times[i] + " minutes.\n";
    }
    signupMessageText += "After a win, post a screenshot of the victory and type !win (only one player on the winning team must do this).";
    var signupMessage = await announcementsChannel.send(signupMessageText);
    activeCheckinMessages.push(signupMessage);
    for(var i = 0; i < times.length; i++)
        await signupMessage.react(emojiList[i]);

    times.sort(numbers); //numbers is a function which makes sort treat the array as numbers rather than strings

    // Now we're going to wait until it's time to read those reactions
    for(i = 0; i < times.length; i++)
    {
        if(i == times.length-1)
            setTimeout(buildMatch, (times[i]*60*1000), signupMessage, emojiList[i], true);
        else
            setTimeout(buildMatch, (times[i]*60*1000), signupMessage, emojiList[i], false);
    }
}

// We read the reactions on the message which tells us what players want to play in that match
async function buildMatch(message, emoji, final, restarted=false)
{
    var roundPlayerList = [];

    message.reactions.forEach((element) => addPlayerToRound(element, roundPlayerList, emoji));


    if((roundPlayerList.length % 10) >= 8 && !restarted)
    {
        announcementsChannel.send("Almost enough players for an extra game (need " + (10-(roundPlayerList.length % 10)) + "), waiting another 5 minutes to start");
        setTimeout(buildMatch, 5*60*1000, message, emoji, final, restarted=true);
        return 0;
    }

    var numOfGames = Math.floor(roundPlayerList.length / 10);
    roundPlayerList.sort(byGamesMissed);
    //roundPlayerList.forEach(element => {
        //bot.users.get(element.discordId).send("You've got a game of pickup league starting. See your teammmates and enemies in the announcements channel.");
    //});
    var sparePlayers = [];
    for(var i = roundPlayerList.length - 1; i >= numOfGames * 10; i--)
    {
        roundPlayerList[i].gamesMissed++;
        sparePlayers.push(roundPlayerList[i]);
        roundPlayerList.pop();
    }

    if(roundPlayerList.length % 10 != 0)
        console.error("SOMETHING WENT HORRIBLY WRONG"); //sanity check

    if(numOfGames == 0)
    {
        announcementsChannel.send("Not enough players for any games.");
        return 0;
    }
    shuffle(roundPlayerList);
    const numOfTeams = numOfGames * 2;
    var teams = [];
    for(var i = 0; i < numOfTeams; i++)
    {
        var temp = new Team();
        temp.autofills = 0;
        temp.secondaries = 0;
        teams.push(temp);
    }
    
    matchmake(roundPlayerList, teams);

    teams.sort(byMMR);
    announcementsChannel.send("We have numbers for " + (numOfGames) + " games!");
    var gameMessage = "";
    for(var i = 0; i < numOfGames; i++)
    {
        gameMessage += "MATCH " + (i+1) + ":\n";
        var thisGame = new Match(teams[i*2], teams[(i*2)+1], sparePlayers);
        var balancedGame = balanceTeams(thisGame.blueTeam, thisGame.redTeam, thisGame.sparePlayers);
        var oldDiff = Math.abs(thisGame.blueTeam.getMMR()-thisGame.redTeam.getMMR());
        var newDiff = Math.abs(balancedGame.blueTeam.getMMR()-balancedGame.redTeam.getMMR());
        gameMessage += balancedGame.teamsString() + "\n\n";
        activeGames.push(balancedGame);
        announcementsChannel.send("MMR diff between teams with old algo: " + oldDiff + " -- New: " + newDiff);
    }
    await announcementsChannel.send(gameMessage);
    if(final)
    {
        activeCheckinMessages.forEach((element, index) => {

            if(element.id == message.id)
            {
                activeCheckinMessages.splice(index, 1);
            }
        });
    }
}

function addPlayerToRound(thisReaction, list, thisGame)
{
    if(thisReaction._emoji.name == thisGame)
    {
        thisReaction.users.forEach(element => {
            var playerIndex = playerListContains(element.id);
            if(playerIndex != -1)
            {
                list.push(playerList[playerIndex]);
            }
            else
            {
                console.log("PLAYER LEFT OUT " + element.id);
            }
        });
    }
}

async function manualResult(channel, players)
{
    players = players.split("'");
    if(players.length != 10)
    {
        channel.send("Should input 10 usernames");
        return 0;
    }
    var overallSuccess = true;
    var playerObjects = [];
    players.forEach(element => {
        var thisPlayerSuccess = false;
        for(var i = 0; i < playerList.length; i++)
        {
            if(playerList[i].nameDisplay==element)
            {
                playerObjects.push(playerList[i]);
                return;
            }
        }
        channel.send("player " + element + " not found");
        overallSuccess = false;
    });
    if(!overallSuccess)
        return 0;

    var blue = new Team(playerObjects[0], playerObjects[1], playerObjects[2], playerObjects[3], playerObjects[4]);
    var red = new Team(playerObjects[5], playerObjects[6], playerObjects[7], playerObjects[8], playerObjects[9]);
    var thisMatch = new Match(blue, red, []);
    await channel.send("Counting a blue side win for this game " + thisMatch.teamsString());
    changeMMR(thisMatch.blueTeam, thisMatch.redTeam);
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

function balanceTeams(teamOne, teamTwo, sparePlayers)
{
    var totalMMR = teamOne.getMMR() + teamTwo.getMMR();
    var playerMatrix = [teamOne.toArray(), teamTwo.toArray()];
    var goalMMR = totalMMR/2;
    var numCombinations = Math.pow(NUM_TEAMS, TEAM_SIZE);
    var minDiff = 100000; // unreasonably large number
    var iN = 31;
    var finalTeam;
    for(var i = 0; i < numCombinations; i++)
    {
        var tempTeam = new Team(playerMatrix[((16&i)>>4)][0], playerMatrix[((8&3)>>4)][1], playerMatrix[((4&i)>>2)][2], playerMatrix[((2&i)>>1)][3], playerMatrix[(1&i)][4]);
        if(Math.abs(goalMMR - tempTeam.getMMR()) < minDiff)
        {
            console.log(Math.abs(goalMMR - tempTeam.getMMR()));
            minDiff = Math.abs(goalMMR - tempTeam.getMMR());
            iN = ~i & 31;
            finalTeam = tempTeam;
        }
    }
    var opponent = new Team(playerMatrix[((16&iN)>>4)][0], playerMatrix[((8&iN)>>3)][1], playerMatrix[((4&iN)>>2)][2], playerMatrix[((2&iN)>>1)][3], playerMatrix[(1&iN)][4]);
    return new Match(finalTeam, opponent, sparePlayers)
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

function resolveMatch(channel, id)
{
    for(var i = 0; i < activeGames.length; i++)
    {
        var playerTeam = activeGames[i].matchContainsPlayer(id);
        if(playerTeam == 1)
        {
            changeMMR(activeGames[i].blueTeam, activeGames[i].redTeam);
            activeGames.splice(i, 1);
            channel.send("Registered a win for blue team");
            return 1;
        }
        if(playerTeam == 2)
        {
            changeMMR(activeGames[i].redTeam, activeGames[i].blueTeam);
            activeGames.splice(i, 1);
            channel.send("Registered a win for red team");
            return 1;
        }
    }
    channel.send("You're not in an active game");
}

// Change the rating of each player in a match (and lower their k-factors if relevant)
function changeMMR(winningTeam, losingTeam)
{
    winningTeam = winningTeam.toArray();
    losingTeam = losingTeam.toArray(); // This code is all much cleaner if teams are just arrays of players

    var winningTeamTotalMMR = 0;
    var losingTeamTotalMMR = 0;
    for(var i = 0; i < 5; i++)
    {
        winningTeamTotalMMR += winningTeam[i].mmr;
        losingTeamTotalMMR += losingTeam[i].mmr;
    }
    console.log(winningTeamTotalMMR + " vs " + losingTeamTotalMMR);

    for(var i = 0; i < winningTeam.length; i++)
    {
        winningTeam[i].wins++;
        var opponentMMR = losingTeamTotalMMR - (winningTeamTotalMMR - winningTeam[i].mmr);
        var prob = (1.0 / (1.0 + Math.pow(10, (((winningTeam[i].mmr-opponentMMR)/5) / 400)))); // Probability of winning
        console.log("win + " + (winningTeam[i].kFactor*(1 - prob)) + "prob + " + (prob));
        winningTeam[i].mmr = winningTeam[i].mmr + winningTeam[i].kFactor*(1 - prob);   // Elo calculation

        if(winningTeam[i].kFactor != 40)
        {
            winningTeam[i].kFactor = winningTeam[i].kFactor*0.92; // Up system's confidence
            if(winningTeam[i].kFactor <= 41)
                winningTeam[i].kFactor = 40; // Set to a stable number when low enough
        }

    }

    for(var i = 0; i < losingTeam.length; i++)
    {
        losingTeam[i].losses++;
        var opponentMMR = winningTeamTotalMMR - (losingTeamTotalMMR - losingTeam[i].mmr);
        var prob = (1.0 / (1.0 + Math.pow(10, (((losingTeam[i].mmr-opponentMMR)/5) / 400)))); // probability of winning
        console.log("loss + " + (losingTeam[i].kFactor*(0 - prob)) + "prob + " + (prob));
        losingTeam[i].mmr = losingTeam[i].mmr + losingTeam[i].kFactor*(0 - prob); // Elo calculation

        if(losingTeam[i].kFactor != 40)
        {
            losingTeam[i].kFactor = losingTeam[i].kFactor*0.92; // Up system's confidence
            if(losingTeam[i].kFactor <= 41)
                losingTeam[i].kFactor = 40;
        }
    }
    writePlayerList();
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
    console.log((signup.getTime() - d.getTime()) + (24 * 60 * 60 * 1000 * daysToNextGameDay));
    return ((signup.getTime() - d.getTime()) + (24 * 60 * 60 * 1000 * daysToNextGameDay));
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

function numbers(a, b)
{
    return (a > b)?(1):(-1);
}

// this function is very specific, maybe this part of the code could be written better
function playerListContains(id)
{
    var contains = -1;
    playerList.forEach((element, index) => 
    {
        if(element.discordId.substring(0, 15) == id.substring(0, 15))
        {
            contains = index;
        }
    });
    return contains;
}

function swap(list, i, j)
{
    var temp = list[i];
    list[i] = list[j];
    list[j] = temp;
}

// -----------------------------------------END HELPERS-------------------------------------------------------
