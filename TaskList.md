(these tasks are in no particular order, it is just a list of everything that needs to be done)

- Make the bot tag @pickup-league (easy)
- Make the bot message everyone who has a game rather than tagging pickup league (requires IDs to be fixed)
- Improve matchmaking (I have a plan for this, it won't make a huge difference though I expect)
    when a game is formed, teams can be additionally balanced after by swapping players in the same position
- Fix bug with recursion
    the function repeatedlyStartGames is not being used because it didn't work. It spammed the announcements channel for several minutes before being turned off. 
    I don't know what is wrong with it, the problem may be in the msToNextGame function (returning 0 sometimes possibly?)
- Properly fix discord IDs. 
    Everyone's discord IDs were rounded due to float inaccuracy (javascript doesn't let you choose to use a 64 bit int or anything)
    I've made a new "trueID" which saves them as strings. For some reason this still doesn't recognise user @blue, no idea why.
- Make the bot give people the @pickup league role when registering


VERSION 2.0.0
- Use tournament codes for every match
    This will involve big changes to registration, players can have multiple IGNs associated with their pickup league standings, they will instead
    of registering "link" an IGN to their discord account.
- Possible use of a database for storage rather than a text file after this.