const Discord = require('discord.js');
const http = require('https');
require('dotenv').config();
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

const client = new Discord.Client();

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

const updateReferrals = async () => {
	const marketingRefCodes = [];
	const options = {
		method: 'GET',
		hostname: 'api.airtable.com',
		port: null,
		path: '/v0/appjqlJY5yL356yoX/Codes?maxRecords=100&view=Grid%20view',
		headers: {
			authorization: 'Bearer ' + process.env.API_KEY,
			'content-length': '0'
		}
	};

	const request = http.request(options, res => {
		const chunks = [];

		res.on('data', chunk => {
			chunks.push(chunk);
		});

		res.on('end', () => {
			const body = Buffer.concat(chunks);

			JSON.parse(body.toString()).records.map(r => {
				marketingRefCodes.push({
					code: r.fields.Code,
					credits: r.fields.Credits
				});
			});
		});
	});

	request.end();

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
						const code = crc32(
							record.get('Name') + record.get('Submission Time')
						).toString(16);
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
						if (
							recordsList[i].assignedRefCode == r.appliedRefCode &&
              r.id != recordsList[i].id &&
              recordsList[i].assignedRefCode != null &&
              r.appliedRefCode != null
						) {
							recordsList[i].numPeopleReferred++;
						}
					});
					// Applied code
					recordsList.map(r => {
						if (
							recordsList[i].appliedRefCode == r.assignedRefCode &&
              r.id != recordsList[i].id &&
              recordsList[i].appliedRefCode != null
						) {
							recordsList[i].appliedRefCodeBoost = 2;
						}
					});

					// Check if marketing ref code

					await marketingRefCodes.map(c => {
						if (recordsList[i].appliedRefCode == c.code && c.code != null) {
							recordsList[i].appliedRefCodeBoost = c.credits;
						}
					});

					// Push updates
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

const profile = message => {
	base('Students')
		.select({
			view: 'Grid view'
		})
		.eachPage(
			function page(records, fetchNextPage) {
				records.forEach(async record => {
					if (record.get('Discord User ID') == message.member.id) {
						await message.channel.send(
							'Your student profile has been messaged to you <@' +
                message.member.id +
                '>.'
						);
						channels = '';
						record
							.get('Courses Channels')
							.join(', ') // Need for courses with more than one channel
							.split(', ')
							.map(i => {
								channels += '<#' + i + '>\n';
							});

						const acode = record.get('Applied Referral Code');

						if (acode) {
							afr =
                'You applied to BT5 with the referral code: `' +
                record.get('Applied Referral Code') +
                '`\nThis referral code had a value of ' +
                record.get('Applied Code Credit Boost') +
                ' credits.';
						} else {
							afr =
                'You did not apply to BT5 with a referral Code. If you have a referral code and would like to apply it to your profile, email admissions. You can only redeem 1 referral code.';
						}

						const m = {
							title: 'Beyond The Five',
							description: 'This is your Beyond The Five student profile.',
							url: 'https://beyondthefive.org',
							color: 2123412,
							timestamp: '2020-07-05T04:58:19.535Z',
							footer: {
								icon_url: 'https://beyondthefive.org/logo.png',
								text: 'Beyond The Five'
							},
							thumbnail: {
								url: 'https://beyondthefive.org/logo.png'
							},
							fields: [
								{
									name: 'Name',
									value: record.get('Name'),
									inline: true
								},
								{
									name: 'Email',
									value: record.get('Email'),
									inline: true
								},
								{
									name: 'Courses',
									value: record.get('Courses List')
								},
								{
									name: 'Class Channels',
									value: channels
								},
								{
									name: 'Credits',
									value:
                    'You are in ' +
                    record.get('Available Credits') +
                    ' credits.'
								},
								{
									name: 'Applied Referral Code',
									value: afr
								},
								{
									name: 'Referral Code',
									value:
                    'Your assigned referral code is: `' +
                    record.get('Assigned Referral Code') +
                    '`\nFor every person that uses this referral code during registration, not only do they get 2 extra credits, but you also get 2 extra credits!'
								},

								{
									name: 'Referral Code Usage',
									value:
                    'Your referral code has been used `' +
                    record.get('# People Referred') +
                    '` times for a total of `' +
                    record.get('Referral Credit Boost') +
                    '` extra credits.'
								},
								{
									name: 'Questions?',
									value:
                    'If you would like to make updates to your student profile, such as adding or dropping classes, email `admissions@beyondthefive.org`.\nYour profile statistics update every 6 hours.\nIf you have questions about BT5, please ask them in <#697302048827506778>.'
								}
							]
						};
						return message.member.send({embed: m});
					}
				});

				fetchNextPage();
			},
			function done(err) {
				if (err) {
					console.error(err);
				}
			}
		);
};

client.on('message', async message => {
	const contents = message.content.toLowerCase().split(' ');
	const cmd = contents[1];
	const args = contents.slice(2);
	if (contents[0] === config.prefix) {
		if (['referralUpdate', 'ru'].includes(cmd)) {
			if (message.channel.id != config.botChannel) {
				return message.channel.send('Sorry buddy, you can\'t do that here.');
			}

			await message.channel.send('Updating referral codes...');
			return updateReferrals();
		}

		if (
			['referrals', 'referral', 'ref', 'profile', 'classes', 'my'].includes(cmd)
		) {
			if (
				message.member.roles.cache.find(
					role => role.id == config.enrolledRole
				)
			) {
				message.channel.startTyping();
				await profile(message);
				return message.channel.stopTyping();
			}

			return message.channel.send(
				'You need to be an enrolled student to use this command.\nIf you have been accepted do not have access to this command yet, please wait ~6 hours. If you still to not have access contact a staff member.'
			);
		}
	}
});

client.login(process.env.token);
