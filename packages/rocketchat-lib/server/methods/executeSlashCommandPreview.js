Meteor.methods({
	executeSlashCommandPreview(command, preview) {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'getSlashCommandPreview',
			});
		}

		if (!command || !command.cmd || !RocketChat.slashCommands.commands[command.cmd]) {
			throw new Meteor.Error('error-invalid-command', 'Invalid Command Provided', {
				method: 'executeSlashCommandPreview',
			});
		}

		const theCmd = RocketChat.slashCommands.commands[command.cmd];
		if (!theCmd.providesPreview) {
			throw new Meteor.Error('error-invalid-command', 'Command Does Not Provide Previews', {
				method: 'executeSlashCommandPreview',
			});
		}

		if (!preview) {
			throw new Meteor.Error('error-invalid-command-preview', 'Invalid Preview Provided', {
				method: 'executeSlashCommandPreview',
			});
		}

		return RocketChat.slashCommands.executePreview(command.cmd, command.params, command.msg, preview);
	},
});
