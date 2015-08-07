var rather = rather || {};
rather.bg = {
	boot: function() {
		rather.bg.poll(); // first load
		rather.bg.sync();

		setInterval(function() { rather.bg.poll(); }, 5000);
		setInterval(function() { rather.bg.sync(); }, 7200000);
	},

	sync: function() {
		rather.log("-----------------------------");
		rather.log("Syncing...");

		rather.init().then(function(err) {
			if(err) {
				rather.log("Critical error syncing user data.");
				return;
			}
		});
	},

	poll: function() {
		rather.log("-----------------------------");
		rather.log("Polling...");

		rather.user.getData().then(function(data) 
		{
			rather.log("Loading replacement feeds...");

			for(var id in data.replacements)
			{
				(function(item)
				{
					rather.log("Checking cache for the following feed :: " + item.replace_id);
					rather.feed.load_cache(item.replace_id).then(function(data)
					{
						// if data is cached we don't care about it.
						if(!data) 
						{
							rather.log("Feed is not cached. Loading now...");
							rather.feed.load(item.feed_url).then(function(err,data)
							{
								if(err) {
									return rather.log("Error loading RSS feed. Ignoring. Item Id :: " + item.replace_id);
								}

								if (item.type == 'Instagram Hashtag')
								{
									var images = rather.feed.parseInstagramPage(data);
								}
								else
								{
									var images = rather.feed.parse(data);
								}
								rather.log(images.length + " images retreived from feed. Caching Item Id ::" + item.replace_id);
								rather.feed.save_cache(item.replace_id,images);
							});
						}
						else {
							rather.log(data.images.length + " images retreived from cache for item :: " + item.replace_id + ". Cache expires " + data.expiration);
						}
					});
				})(data.replacements[id]);
			}
		});
	}
};

rather.bg.boot();