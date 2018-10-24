export default function handleNickChanged(args) {
	const user = RocketChat.models.Users.findOne({
		'profile.irc.nick': args.nick,
	});

	if (!user) {
		throw new Error(`Could not find an user with nick ${ args.nick }`);
	}

	this.log(`${ user.username } changed nick: ${ args.nick } -> ${ args.newNick }`);

	// Update on the database
	RocketChat.models.Users.update({ _id: user._id }, {
		$set: {
			name: args.newNick,
			'profile.irc.nick': args.newNick,
		},
	});
}
