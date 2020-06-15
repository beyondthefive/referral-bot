const Discord = require('discord.js');
require('dotenv').config();
const express = require('express');
const app = express();
const config = require('./config.js');
const Airtable = require('airtable');
const base = new Airtable({apiKey: process.env.API_KEY}).base(
	'apprEDMBB2pnH11HZ'
);
const {crc32} = require('crc');

function msleep(n) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

function sleep(n) {
	msleep(n * 1000);
}

app.listen(() => console.log('Server started'));

app.use('/', (request, res) => {
	res.send('Online.');
});

const client = new Discord.Client();

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

const updateReferrals = () => {
	const logChannel = client.guilds.cache
		.get(config.guildID)
		.channels.cache.get(config.logChannelID);
	recordIDs = [];
	refCodes = [];
	const recordsList = [];
	base('Students')
		.select({
			view: 'Grid view'
		})
		.eachPage(
			function page(records, fetchNextPage) {
				const recordsSection = [];
				records.forEach(async record => {
					if (record.get('Assigned Referral Code') == null) {
						const code = crc32(record.get('Submission Time')).toString(16);
						base('Students')
							.update([
								{
									id: record.id,
									fields: {
										'Assigned Referral Code': code
									}
								}
							])
							.then(
								async () =>
									await logChannel.send(
										'Created referral code for ' +
                      record.get('Name') +
                      ' `' +
                      record.get('Discord Username') +
                      '` - ' +
                      code
									)
							);
					}

					recordsSection.push({
						id: record.id,
						name: record.get('Name'),
						assignedRefCode: record.get('Assigned Referral Code'),
						appliedRefCode: record.get('Applied Referral Code'),
						appliedRefCodeBoost: 0,
						recordedAppliedRefCodeBoost: record.get(
							'Applied Code Credit Boost'
						),
						recordedNumPeopleReferred: record.get('# People Referred'),
						numPeopleReferred: 0
					});
				});

				recordsSection.map(i => {
					recordsList.push(i);
				});
				fetchNextPage();
			},
			async function done(err) {
				if (err) {
					console.error(err);
					return channel.send(
						'<@581319977265790986> Error updating referral codes.'
					);
				}

				await logChannel.send('Referral codes have been updated.');
				await logChannel.send('Updating referral statistics...');

				for (let i = 0; i < recordsList.length; i++) {
					// Referred people
					recordsList.map(r => {
						if (recordsList[i].assignedRefCode == r.appliedRefCode) {
							recordsList[i].numPeopleReferred++;
						}
					});
					// Applied code
					recordsList.map(r => {
						if (
							recordsList[i].appliedRefCode == r.assignedRefCode &&
              r.id != recordsList[i].id
						) {
							recordsList[i].appliedRefCodeBoost += 2; // 2 credits per referred person
						}
					});

					// Update ref credits
					if (
						recordsList[i].numPeopleReferred !=
              recordsList[i].recordedNumPeopleReferred ||
            recordsList[i].recordedAppliedRefCodeBoost !=
              recordsList[i].appliedRefCodeBoost
					) {
						await base('Students')
							.update([
								{
									id: recordsList[i].id,
									fields: {
										'# People Referred': recordsList[i].numPeopleReferred,
										'Applied Code Credit Boost':
                      recordsList[i].appliedRefCodeBoost
									}
								}
							])
							.then(
								async () =>
									await logChannel.send(
										'Updated referral stats for ' +
                      recordsList[i].name +
                      ' - `' +
                      recordsList[i].numPeopleReferred +
                      '` people referred.'
									)
							);
					}
				}

				return logChannel.send('Referral statistics have been updated.');
			}
		);
};

client.on('message', async message => {
	const contents = message.content.toLowerCase().split(' ');
	const cmd = contents[1];
	const args = contents.slice(2);
	if (contents[0] === config.prefix) {
		if (['referralUpdate', 'ru'].includes(cmd)) {
			await message.channel.send('Updating referral codes...');
			return updateReferrals();
		}

		if (['referrals', 'referral', 'ref'].includes(cmd)) {
			return message.channel.send('hi');
		}
	}
});

client.login(process.env.token);
