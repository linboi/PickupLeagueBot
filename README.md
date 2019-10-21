# Task List

- [ ] Make the bot tag @pickup-league (easy)
- [ ] Make the bot message everyone who has a game rather than tagging pickup league (requires IDs to be fixed)
- [ ] Improve matchmaking (I have a plan for this, it won't make a huge difference though I expect) when a game is formed, teams can be additionally balanced after by swapping players in the same position
- [ ] Fix bug with recursion the function repeatedlyStartGames is not being used because it didn't work. It spammed the announcements channel for several minutes before being turned off. I don't know what is wrong with it, the problem may be in the msToNextGame function (returning 0 sometimes possibly?)
- [ ] Properly fix discord IDs. Everyone's discord IDs were rounded due to float inaccuracy (javascript doesn't let you choose to use a 64 bit int or anything) I've made a new "trueID" which saves them as strings. For some reason this still doesn't recognise user @blue, no idea why.
- [x] Make the bot give people the @pickup league role when registering

## Version 2.0.0

- [ ] Use tournament codes for every match This will involve big changes to registration, players can have multiple IGNs associated with their pickup league standings, they will instead of registering "link" an IGN to their discord account.
- [ ] Possible use of a database for storage rather than a text file after this.

# Change Log

## 1.4.0 - 21/10/2019
Improve matchmaking
More fixes to do with discord IDs

## 1.3.5 - 16/10/2019
Start to record people's true ID, and only use the first 15 digits of recorded IDs

## 1.3.4 - 13/10/2019
Fix replacement function when no spare players signed up

## 1.3.3 - 12/10/2019
Remove tendency for newly registered players to be left out

## 1.3.1 - 12/10/2019
Fix whitespace bug in standings

## 1.3.0 - 30/09/2019
Improve standings common use case
Replace standings with fullstandings
Quit is admin only, and renamed to write

## 1.2.0 - 29/09/2019
Change MMR calculations
Add admin only commands

## 1.1.1 - 28/09/2019
Fix file reading
Remove recursion

## 1.1.0 - 25/09/2019
Remove testing code.
Write player list after registration.
Improve various messages sent by bot.

## 1.0.0 - 24/09/2019
Initial release