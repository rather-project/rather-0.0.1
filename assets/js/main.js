var rather = {

	app :  				document.querySelector('#app'),
	filterSwitch: 		document.querySelector('.switch'),
	footer: 			document.querySelector("footer"),
	filteringOptions: 	document.querySelectorAll(".filtering-options a"),
	tabsNav: 			document.querySelector(".tabs .nav"),
	currentTab: 		document.querySelector(".tabs .nav .active"),
	tabContent: 		document.querySelector('.tabs .content'),
	searchBox: 			document.querySelector(".search-box"),
	killList: 			document.querySelector(".kill-list ul"),
	replacementList: 	document.querySelector('.replacement ul'),
	replacementInput: 	document.querySelector('.replacement input'),
	loginScreen: 		document.getElementById("login-screen"),
	claimScreen: 		document.getElementById("claim-screen"),
	editListScreen: 	document.getElementById("edit-list-screen"),
	bPredictiveInit: false,


	user: {
		token:null,

		setData:function(data, cb) {
			console.log('set user data', data);
			chrome.storage.local.set({'rather-user-data':data}, function()
			{
				if (cb && typeof cb == 'function') cb();
			});
		},
		updateData:function(key, val)
		{
			rather.user.getData().then(function(data)
			{
				data[key] = val;
				rather.user.setData(data);
				console.log('update user data', data);
			});
		},
		getData:function() {
			var p = new promise.Promise();
			chrome.storage.local.get('rather-user-data',function(obj)
			{
				if(!obj['rather-user-data']) obj['rather-user-data'] = {};

				// clean the object up a bit to make it easier to check for errors
				var data = obj['rather-user-data'];
				data.wordsets = data.wordsets || {};
				data.replacements = data.replacements || {};
				data.filter_facebook = data.filter_facebook || 'replace';
				data.filter_twitter = data.filter_twitter || 'replace';
				data.filter_type = data.filter_type || 'replace';
				console.log('get user data', data);
				p.done(data);
			});

			return p;
		}
	},

	// The startup method
	boot: function(){


		// var data = {};
		// 		data.wordsets = data.wordsets || {};
		// 		data.replacements = data.replacements || {};
		// 		data.filter_facebook = data.filter_facebook || 'replace';
		// 		data.filter_twitter = data.filter_twitter || 'replace';
		// 		data.filter_type = data.filter_type || 'replace';
		// rather.user.setData(data);


		rather.init().then(function(err) {
			if(err) {
				rather.log("Critical error booting up.");
				return;
			}

			rather.log("User Token :: " + rather.user.token);

			rather.setupMouseEvents();
			rather.populateContent();
		});

	},

	// get the latest data
	init: function(tries) {
		var p = new promise.Promise();
		var tries = tries || 0;

		chrome.storage.sync.get('rather-user-token',function(obj) 
		{
			var token = (obj['rather-user-token']) ? obj['rather-user-token'] : Math.random();
			rather.user.token = token;
			chrome.storage.sync.set({'rather-user-token':token});
			p.done(null);
		});

		return p;
	},

	setupMouseEvents: function(err) {
		// Start watching for a filter click
		vine.bind(rather.filterSwitch, "click", function(evt){
			rather.ui.toggleFilter(evt,this);
		});

		// Watch and hide message notifications
		[].forEach.call( document.querySelectorAll('#notification > a'), function(el) {
  			el.addEventListener('click', function(evt) {
  		 		rather.ui.toggleMessage(evt,this);

  			}, false);
		});


		// contact buttons
		document.querySelector(".contact-trigger").addEventListener("click",function(evt) {
			rather.ui.contactButtonClicked(evt,this);
		},false);


		[].forEach.call( document.querySelectorAll("footer .contact"), function(el) {
			el.addEventListener('click',function(evt) {
				rather.ui.contactButtonClicked(evt,this);
			});
		});

		// cancel buttons (every subsection)
		[].forEach.call( document.querySelectorAll("nav .cancel"), function(el) {
			el.addEventListener("click",function(evt) {
				evt.preventDefault();
				document.querySelector("body").removeAttribute("id");
			})
		});

		document.querySelector("nav .save").addEventListener('click',function(evt) {
			rather.kill.submit(evt,this);
		});

		// list creation
		document.querySelector(".kill-list p a").addEventListener('click',function(evt) {
			rather.kill.create(evt,this);
		});

		document.querySelector('.kill-list h2 a').addEventListener('click', function(evt)
		{
			rather.kill.create(evt, this);
		});

		// filters
		[].forEach.call( rather.filteringOptions, function(el) {
			el.addEventListener('click', function(evt) {
				rather.ui.toggleFilterOption(evt,this);
			}, false);
		});

		// replacement input
		rather.replacementInput.addEventListener('keyup',function(evt) {
			rather.replacements.keyUp(evt,this);
		});
	},

	populateContent: function() {
		rather.log("Populating Content...");

		// clear
		rather.killList.innerHTML = "";
		rather.replacementList.innerHTML = "";

		rather.user.getData().then(function(data) {
			// kill lists
		
			var wordset_length = 0;
			console.log(data.wordsets);
			for(var key in data.wordsets) {
				wordset_length++;
				rather.kill.add(data.wordsets[key]);
			}

			if(wordset_length == 0) document.querySelector(".kill-list p").classList.remove("hide");

			// replacements
			
			var replacement_length = 0;
			for(var key in data.replacements) {
				replacement_length++;
				rather.replacements.add(data.replacements[key]);
			}


			if(replacement_length == 0) document.querySelector(".replacement p").classList.remove("hide");

			// global filters
			['facebook','twitter'].forEach(function(service) {
				if(data['filter_' + service]) {
					(data['filter_' + service] == 'replace') ? rather.ui.enableFilterOption(service) : rather.ui.disableFilterOption(service);
				}
			});

			// toggle button
			if(data['filter_type']) {
				if(data['filter_type'] == 'mute') rather.ui.toggleMute();
				else rather.ui.toggleReplace();
			}

			var wordsetIds = [];
			for(var _id in data.wordsets) {
				wordsetIds.push(_id);
			}

			document.querySelector("body").classList.remove("hidden"); // fouc
		});			
	},

	// Lets us log things
	// it's log, log, it's big it's bad it's wood. it's log, log, it's better than bad it's good!
	log: function(say)
	{
		console.log("rather: ",say);
	},

	// The UI Controls
	ui: 
	{
		setFlash: function(type,message,duration) {
			if(!duration || duration == 0) duration = 5000; // default to 5 seconds

			var t = document.getElementById("flash");
			var c = t.content.childNodes[1].cloneNode(true);

			c.classList.remove("error-or-notice-or-success");
			c.classList.add(type);

			c.querySelector(".txt").innerText = message;

			document.getElementById("notification").appendChild(c);

  			c.addEventListener('click', function(evt) {
  		 		rather.ui.toggleMessage(evt,this);
  			}, false);

  			// if duration is -1 leave it up forever.
  			if(duration > 0) {
				setTimeout(function() {
					if(c.parentNode) c.parentNode.removeChild(c);
				},5000);
  			}
		},

		contactButtonClicked: function(evt,that) {
			evt.preventDefault();

			var mail = 'mailto:hello@getrather.com';
	    	var newWin = window.open(mail);
		    setTimeout(function(){newWin.close()}, 500);
		},

		toggleFilter: function(evt,that){
			evt.preventDefault();
			rather.footer.classList.toggle('on');
			rather.filterSwitch.classList.toggle('on');
			var status = rather.footer.classList.contains("on") ? "mute" : "replace";
			rather.user.updateData('filter_type', status);
		},

		toggleMute: function() {
			rather.footer.classList.add('on');
			rather.filterSwitch.classList.add('on');
		},

		toggleReplace: function() {
			rather.footer.classList.remove('on');
			rather.filterSwitch.classList.remove('on');
		},

		toggleMessage: function(evt,message){
			evt.preventDefault();
			message.remove(message.selectedIndex);
		},

		toggleFilterOption: function(evt,that) {
			evt.preventDefault();
			that.classList.toggle("active");

			var service;
			if(that.classList.contains("facebook"))
				service = "facebook";
			else if(that.classList.contains("twitter"))
				service = "twitter";

			var val = that.classList.contains("active") ? 'replace' : 'mute';
			rather.user.updateData("filter_" + service, val);
		},

		enableFilterOption: function(service) {
			[].forEach.call(rather.filteringOptions,function(el) {
				if(el.classList.contains(service)) el.classList.add("active");
			});
		},

		disableFilterOption: function(service) {
			[].forEach.call(rather.filteringOptions,function(el) {
				if(el.classList.contains(service)) el.classList.remove("active");
			});
		},

		tabNavSelected: function(evt,that) {
			evt.preventDefault();

			var tabId;

			rather.currentTab.classList.remove("active");

			tabId = rather.currentTab.getAttribute("href").substring(1);
			document.getElementById(tabId).classList.add("hide");

			rather.currentTab = that;
			rather.currentTab.classList.add("active");

			tabId = rather.currentTab.getAttribute("href").substring(1);
			document.getElementById(tabId).classList.remove("hide");
		},

		tabContentClicked: function(evt,that) {
			evt.preventDefault();
			that.parentNode.removeChild(that);

			var type = that.getAttribute("data-service-type");

			var item = {};
			item.name = that.getAttribute("data-name");

			if(type == "feeds") {
				item.feed_url = that.getAttribute("data-metadata");
				rather.replacements.clone(item);
			}
			else {
				item.wordset_id = that.getAttribute("data-metadata");
				rather.kill.clone(item);
			}

		}
	},

	kill: 
	{
		add: function(item) {
			var t = document.getElementById("kill");
			var c = t.content.childNodes[1].cloneNode(true);

			c.querySelector(".txt").innerText = item.name;
			c.setAttribute("data-wordset_id",item.wordset_id);

			rather.killList.appendChild(c);

			// edit
			c.addEventListener('click',function(evt) {
				rather.kill.edit(evt,this);
			},false);


			// close
			c.querySelector('.x').addEventListener('click', function(evt) {
				rather.kill.remove(evt,this);
			},false);

			// toggle buttons
			[].forEach.call( c.querySelectorAll('.toggles a'), function(el) {
				if(item.services) {
					var service;
					if(el.classList.contains("facebook")) service = "facebook";
					else if(el.classList.contains("twitter")) service = "twitter";

					if(item.services[service] == 0) el.classList.remove("active");
				}

				el.addEventListener('click', function(evt) {
					rather.kill.toggle(evt,this);
				},false);
			});

			document.querySelector(".kill-list p").classList.add("hide");
		},

		remove: function(evt,that) 
		{
			evt.stopPropagation();
			evt.preventDefault();

			var target = that;
			var tagName = that.tagName;
			while(target && tagName != 'LI') {
				target = target.parentNode;
				tagName = target.tagName;
			}

			if(!target) {
				rather.log("Weird, clicked a close button that wasn't in a list item.");
				return;
			}

			var parent = target.parentNode;
			parent.removeChild(target);
			if(parent.childNodes.length == 0) document.querySelector(".kill-list p").classList.remove("hide");

			var wordset_id = target.getAttribute("data-wordset_id");

			rather.user.getData().then(function(d)
			{
				console.log(d,wordset_id);
				if (!d.wordsets[wordset_id]) return;
				delete(d.wordsets[wordset_id]);
				rather.user.setData(d);
			});
		},

		toggle: function(evt,that) 
		{
			evt.stopPropagation();
			evt.preventDefault();

			that.classList.toggle("active");

			var target = that;
			var tagName = that.tagName;
			while(target && tagName != 'LI') {
				target = target.parentNode;
				tagName = target.tagName;
			}

			if(!target) {
				rather.log("Weird, clicked a toggle button that wasn't in a list item.");
				return;
			}

			var wordset_id = target.getAttribute("data-wordset_id");
			var data = {};
			[].forEach.call(target.querySelectorAll(".toggles a"),function(el) {
				var service;

				if(el.classList.contains("facebook")) service = "facebook";
				else if(el.classList.contains("twitter")) service = "twitter";

				data[service] = el.classList.contains("active") ? 1 : 0;
			});

			rather.user.getData().then(function(d)
			{
				console.log(d.wordsets[wordset_id]);
				if (!d.wordsets[wordset_id]) return;
				d.wordsets[wordset_id].services = data;
				rather.user.setData(d);
			});
		},

		edit: function(evt,that) 
		{
			evt.preventDefault();

			var wordset_id = that.getAttribute("data-wordset_id");

			rather.user.getData().then(function(data) 
			{
				if(!data.wordsets[wordset_id]) {
					rather.log("Error : attempting to edit a list that does not exists!");
					return;
				}

				rather.editListScreen.setAttribute("data-wordset_id",wordset_id);

				rather.editListScreen.querySelector("input.name").value = data.wordsets[wordset_id].name;
				rather.editListScreen.querySelector("textarea.words").value = data.wordsets[wordset_id].words;

				document.querySelector("body").setAttribute("id","edit-list-open");
				document.querySelector("body").scrollTop = 0;

			});

		},

		create:function(evt,that) 
		{
			evt.preventDefault();

			rather.editListScreen.removeAttribute("data-wordset_id");

			rather.editListScreen.querySelector("input.name").value = "";
			rather.editListScreen.querySelector("textarea.words").value = "";

			document.querySelector("body").setAttribute("id","edit-list-open");
			document.querySelector("body").scrollTop = 0;

		},

		submit:function(evt,that) 
		{
			evt.preventDefault();

			var wordset_id = rather.editListScreen.getAttribute("data-wordset_id");

			var data = {};
			data.name = rather.editListScreen.querySelector("input.name").value.trim();
			data.words = rather.editListScreen.querySelector("textarea.words").value.trim();

			if(data.name == "" || data.words == "") {
				rather.ui.setFlash("error","Please fill out all fields.");
				return;
			}

			data.services = {'facebook':1,'twitter':1};
			
			rather.user.getData().then(function(d)
			{
				var id = wordset_id ? wordset_id : data.name.replace(/\s/g,'_');
				data.wordset_id = id;
				if (!d.wordsets) d.wordsets = {};
				d.wordsets[id] = data;
				rather.user.setData(d, function()
				{
					// repopulate content is easier to do than anything else.
					if(wordset_id)
						rather.ui.setFlash("success","List updated! Now hit refresh.");
					else
						rather.ui.setFlash("success","New list added!");

					rather.populateContent();

					// go back home
					document.querySelector("body").removeAttribute("id");
				});
			});
		}
	},

	replacements: 
	{
		add: function(item) 
		{
			var t = document.getElementById("replacements");
			var c = t.content.childNodes[1].cloneNode(true);

			c.querySelector(".txt").innerText = item.name;
			c.setAttribute("data-replace_id",item.replace_id)

			rather.replacementList.appendChild(c);

			c.addEventListener('click', function(evt) {
				rather.replacements.remove(evt,this);
			});

			document.querySelector(".replacement p").classList.add("hide");
		},

		remove: function(evt,that) {
			evt.preventDefault();

			var target = that;
			var tagName = that.tagName;
			while(target && tagName != 'LI') {
				target = target.parentNode;
				tagName = target.tagName;
			}

			if(!target) {
				rather.log("Weird, clicked a close button that wasn't in a list item.");
				return;
			}

			var parent = target.parentNode;
			parent.removeChild(target);
			if(parent.childNodes.length == 0) document.querySelector(".replacement p").classList.remove("hide");

			var replace_id = target.getAttribute("data-replace_id");

			rather.user.getData().then(function(data)
			{
				delete( data.replacements[replace_id] );
				rather.user.setData(data);
			});
		},

		keyUp: function(evt, that) 
		{
			if(evt.keyCode == 13) 
			{
				evt.preventDefault();

				var regex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

				var v = that.value.trim();

				if(that.value.split(" ").join("").length == 0) return;

				var feed;
				var type;
				if(regex.test(v) == true) {
					feed = v;
					type = "RSS Feed";
				}
				else {
					feed = "https://instagram.com/explore/tags/"+v+"/";
					type = "Instagram Hashtag";
				}

				rather.user.getData().then(function(data) 
				{
					var isDuplicateFeed = data.replacements[ feed ];
					if(isDuplicateFeed) {
						rather.log("Duplicate feed detected.");
						return;
					}

					data.replacements[ feed ] = 
					{
						feed_url: feed,
						type: type,
						name: v,
						replace_id: feed
					};

					rather.user.setData(data);

					rather.replacements.add(data.replacements[feed]);

				});

				that.value = "";
			}
		}
	},

	// used by background processes
	feed: 
	{
		parser: new DOMParser(),

		load: function(feed_url) 
		{
			rather.log("Loading Feed :: " + feed_url);

			var p = new promise.Promise();

			promise.get(feed_url).then(function(err,text,xhr) {
				if(err) return p.done(err);

				p.done(null,xhr.responseText);
			});

			return p;
		},

		// returns an array of images
		parse: function(rss) {
			var xml = rather.feed.parser.parseFromString(rss,"text/xml");
			var images = [];
			if(!xml) {
				rather.log("Invalid XML file. Returning 0 items.");
				return images;
			}

			var items = xml.getElementsByTagName('item');
			var entries = xml.getElementsByTagName('entry');

			[].forEach.call(items,function(item) {
				var description = item.querySelector("description");

				if(description) {
					var div = document.createElement("div");

					// replace the img tag with the template tag so it doesn't load the image automatically.
					try {
						div.innerHTML = description.firstChild.textContent.split("<img").join("<template");

						[].forEach.call(div.querySelectorAll("template"),function(img) {
							images.push(img.getAttribute("src"));
						});						
					}
					catch(e) {
						rather.log("Error parsing items.");
					}
				}
			});

			// basically the same thing as above for entries, but with different tags
			[].forEach.call(entries,function(item) {
				var description = item.querySelector("content");

				if(description) {
					var div = document.createElement("div");

					// replace the img tag with the template tag so it doesn't load the image automatically.
					try {
						div.innerHTML = description.firstChild.textContent.split("<img").join("<template");

						[].forEach.call(div.querySelectorAll("template"),function(img) {
							images.push(img.getAttribute("src"));
						});						
					}
					catch(e) {
						rather.log("Error parsing entries.");
					}
				}
			});

			return images;
		},

		/**
		 * parse instagram explore page 
		 * because instagram rss feed is broken now
		 */
		parseInstagramPage: function(s)
		{
			var arr = s.split('window._sharedData =');
			if (!arr || !arr[1]) return [];
			arr = arr[1].split('</script>');
			var json = arr[0].replace(/[\;\r\n]+$/,'');

			var data = JSON.parse(json);
			console.log(data);
			var imgs = data.entry_data.TagPage[0].tag.media.nodes;
			console.log(imgs);
			var images = [];
			for(var i=0;i<imgs.length;i++)
			{
				if (!imgs[i].is_video && imgs[i].display_src) images.push( imgs[i].display_src);
			}
			return images;
		},

		save_cache: function(title,images) {
			var title = title.trim().toLowerCase();
			var key = "rather-feed-" + title;

			var expiration = Date.now();
			expiration += 900000; // 30 minutes
			expiration += Math.floor((Math.random()*100)+600000); // stagger up to 10 minutes to space out calls

			var data = {};
			data[key] = { expiration: expiration, images: images }; 

			chrome.storage.local.set(data);
		},

		load_cache: function(title) {
			var title = title.trim().toLowerCase();
			var key = "rather-feed-" + title;
			// key += Date.now(); 			// uncomment to never use the cache.

			var p = new promise.Promise();
			chrome.storage.local.get(key,function(obj) {
				var data = obj[key];
				if(!data) {
					return p.done(null);
				}

				var date = Date.now();
				var expiration = data.expiration;

				if(date > expiration) {
					rather.log("Cached Data has expired. Removing it.");

					chrome.storage.local.remove(key);
					return p.done(null);
				}

				p.done(data);
			});

			return p;
		}
	}
}

// Start this party. IS_MAIN_WINDOW is set in main-boot.js so we can use main.js i the background as well.
if(window.RATHER_EXTENSION_IS_MAIN_WINDOW) rather.boot();
