var rather = rather || {};
rather.inject = {
	bMuting: false,
	service: "undefined",

	init: function(service) {
		if(!service && service != "facebook" && service != "twitter") {
			rather.log("Unknown service :: " + service);
			return;
		}

		rather.inject.service = service;

		rather.user.getData().then(function(data) 
		{
			if(data["filter_" + service] != 'replace')
			{
				rather.log("User has disabled this service. Exiting.");
				return;
			}

			if(typeof data.wordsets == "object")
			{
				var a = [];
				for(var key in data.wordsets) {
					a.push(data.wordsets[key]);
				}

				data.wordsets = a;
			}

			if(data.wordsets.length == 0) {
				rather.log("User doesn't have any Wordsets. Exiting.");
				return;
			}

			// add words
			data.wordsets.forEach(function(item) 
			{
				if(!item.services) item.services = {};
				if(item.services[rather.inject.service] == 1)
				{
					var words = item.words.split(",");
					var sanitizedWords = [];
					for(var i=0;i<words.length;i++)
					{
						var word = words[i];
						if(word.indexOf("/(.*)", word.length - word.length) !== -1)
						{
							rather.inject.replacements.push(new RegExp(word));
						}
						else 
						{
							// sanitization courtesy unbaby.me
							word = word.replace(/^\s+|\s+$/g,'');
							word = word.toLowerCase().replace(/[^a-z0-9\'\"\s]/g,'').replace(/\s+/g,'\\s+').replace(/([\'\"])/g,'\\$1');
							if(word != "") sanitizedWords.push(word);
						}
					}

					rather.inject.words = rather.inject.words.concat(sanitizedWords);
				}
			});

			if(rather.inject.words.length == 0 && rather.inject.replacements.length == 0) {
				rather.log("User must have disabled this service entirely. Exiting.");
				return;
			}

			if(rather.inject.words.length == 0) rather.inject.expression = false;
			else {
				// create a regex from the sanitize words so it runs faster
				var sanitizedWordsAsExpression = '\\b'+rather.inject.words.join('\\b|\\b')+'\\b';
				var regex = new RegExp(sanitizedWordsAsExpression,'i');
				rather.inject.expression = regex;				
			}

			// if the user is muting...
			if(data.filter_type) {
				if(data.filter_type == "mute") rather.inject.bMuting = true;
			}
			var ready = new promise.Promise();

			// or they don't have any replacements...
			if(typeof data.replacements == "object") {
				var a = [];
				for(var key in data.replacements) {
					a.push(data.replacements[key]);
				}

				data.replacements = a;
			}

			if(data.replacements.length == 0) 
			{
				rather.inject.bMuting = true;
				ready.done();
			}
			else 
			{
				// load all the replacement images
				var itemsAccountedFor = [];

				data.replacements.forEach(function(item) {
					var p = new promise.Promise();

					rather.feed.load_cache(item.replace_id).then(function(data) {
						if(data) {
							rather.inject.images.all = rather.inject.images.all.concat(data.images);
							p.done();
						}
					});

					p.then(function() {
						itemsAccountedFor.push(item);
						if(itemsAccountedFor.length == data.replacements.length) {
							ready.done();
						}
					});
				});
			}



			ready.then(function() {
				rather.inject.images.reset();
				rather.inject.parse();
				setInterval(function() { rather.inject.poll(); },500);
			});
		});
	},

	words: [],
	expression: null,
	replacements: [],

	images: {
		all: [],
		queue: [],

		reset: function() {

			rather.inject.images.queue = array_shuffle(rather.inject.images.all.slice(0));
		},

		next: function() {
			var item = rather.inject.images.queue.pop();
			if(rather.inject.images.queue.length <= 0) rather.inject.images.reset();

			return item;
		}
	},

	parse: function() 
	{
		if(rather.inject.service == "twitter") {
			var root = document.getElementById('stream-items-id');
			if(!root) {
				rather.log("Cannot find the root node on this page. Probably on a login screen or something. Exiting.");
				return;
			}

			var els = root.querySelectorAll('.tweet');

			[].forEach.call(els,function(el)
			{
				if(!el.getAttribute("data-rather-app-is-checked")) {
					el.setAttribute('data-rather-app-is-checked',"yes");

					var text = el.innerText;
					var bReplaced = false;


					if(text && rather.inject.expression && rather.inject.expression.test(text)) {
						bReplaced = true;
						rather.inject.replace(el);
					}
					else if(text) {
						rather.inject.replacements.forEach(function(regex) {
							if(bReplaced) return;
							if(regex.test(text)) {
								rather.inject.replace(el);
								bReplaced = true;
							}
						});						
					}

					// expanded tweets
					if(!bReplaced) {
						var tweetText = el.querySelector(".tweet-text");

						if(tweetText) {
							if(tweetText.innerText && rather.inject.expression && rather.inject.expression.test(tweetText.innerText)) {
								bReplaced = true;
								rather.inject.replace(el);
							}
							else if(tweetText.innerText) {
								rather.inject.replacements.forEach(function(regex) {
									if(bReplaced) return;

									if(regex.test(tweetText.innerText)) {
										rather.inject.replace(el);
										bReplaced = true;
									}
								});
							}
						}
					}
				}
			});
		}
		else if(rather.inject.service == "facebook") 
		{
			var root = document.getElementById("stream_pagelet");
			if(!root) {
				rather.log("Cannot find the root node on this page. Probably on a login screen or something. Exiting.");
				return;
			}
			var children = root.querySelectorAll('div[data-insertion-position][data-ft]');

			[].forEach.call(children,function(el) {
				if(!el.getAttribute("data-rather-app-is-checked")) {
					el.setAttribute('data-rather-app-is-checked',"yes");

					// thanks unbaby.me!
					// if(  
					// 	el.querySelector('.uiScaledImageContainer')  //photo
					// 	|| 
					// 	el.querySelector('.uiScaledThumb') //photo
					// 	||
					// 	el.innerHTML.match(/facebook\.com\/media\/set\//i) //gallery
					// 	||
					// 	el.querySelector('.uiVideoThumb')  //video
					// 	|| 
					// 	el.querySelector('.shareMediaVideo') //video
					// 	||
					// 	el.innerHTML.match(/data\-appname\=/) //apps
					// 	||
					// 	el.querySelector('.mbs.userContent') //any item contains user message
					//    ) 
					if (true) //replace any kind of messages
					{
						var text = el.innerText;
						if(text && rather.inject.expression && rather.inject.expression.test(text)) {
							rather.inject.replace(el);
						}
						else if(text) {
							var bReplaced = false;
							rather.inject.replacements.forEach(function(regex) {
								if(bReplaced) return;
								if(regex.test(text)) {
									rather.inject.replace(el);
									bReplaced = true;
								}
							});
						}		
					}
				}
			});
		}

	},

	poll: function() {
		rather.inject.parse();
	},

	templates: {
		twitter: Hogan.compile('\
		<div class="stream-item-header rather-app-replace-twitter">\
			<a class="account-group js-account-group js-action-profile js-user-profile-link js-nav" href="javascript:;">\
				<img data-avatar="yes" class="avatar js-action-profile-avatar" src="{{avatar}}" />\
				<img data-avatar="yes" class="avatar js-action-profile-avatar rather-avatar" src="{{rather-avatar}}">\
				<strong class="fullname js-action-profile-name show-popup-with-id rather-app-logo"></strong>\
			</a>\
			<strong class="fullname js-action-profile-name show-popup-with-id rather-app-undo">Undo</strong>\
			<small class="time"></small>\
      	</div>\
      	<p class="js-tweet-text">\
      		{{^muted}}\
	      		<img src="{{image}}" class="rather-app-replacement-image rather-app-replacement-image-twitter" />\
	      	{{/muted}}\
      	</p>'),

      	facebook: Hogan.compile('\
      	<div class="rather-app-replace-facebook">\
			<img class="rather-avatar" src="{{rather-avatar}}" />\
	      	<h6 class="uiStreamMessage uiStreamHeadline uiStreamPassive">\
				\
				<a href="javascript:;" class="rather-app-undo">Undo</a>\
			</h6>\
			{{^muted}}\
			<div class="rather-app-fb-image-container">\
				<img src="{{image}}" class="rather-app-replacement-image rather-app-replacement-image-facebook" />\
			</div>\
			{{/muted}}\
		</div>')
	},

	replace: function(el) {
		var image = rather.inject.images.next();

		var data = {};
		data['title'] = rather.inject.bMuting ? "Muted" : "Replaced";
		data["rather-avatar"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNS1jMDE0IDc5LjE1MTQ4MSwgMjAxMy8wMy8xMy0xMjowOToxNSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NUE3NUQxRTA4MjA2ODExQkVEQ0VDMTJCMTdFMDUyRiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo5MEY3MkRGMDM5QkMxMUUzODhGRkE4REJBQTdBNDJCNyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo5MEY3MkRFRjM5QkMxMUUzODhGRkE4REJBQTdBNDJCNyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RkVCREI5RkE4QjIwNjgxMTgyMkE5Rjk1NEVBREY0RDYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NzVBNzVEMUUwODIwNjgxMUJFRENFQzEyQjE3RTA1MkYiLz4gPC9yZGY6RGVzY3Jp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";
		data["image"] = image;
		data["muted"] = rather.inject.bMuting;
		if(rather.inject.service == "twitter") data['avatar'] = el.querySelector('.avatar').src;

		var content;

		var div = document.createElement("div");
		var html = rather.inject.templates[rather.inject.service].render(data);
		div.innerHTML = html;

		if(rather.inject.service == "twitter") {
			content = el.querySelector('.content');

			div.classList.add("content");

			// fix Twitter's timestamp
			var originalTimeHTML = el.querySelector('.time').innerHTML;
			div.querySelector(".time").innerHTML = originalTimeHTML;
		}
		else if(rather.inject.service == "facebook") {
			//content = el.querySelector("._5pax") || el;
			content = el.querySelector('.userContentWrapper') || el;
		}

		div.classList.add("rather-app-replacement");
		content.style.display = "none";

		// undo button
		div.querySelector(".rather-app-undo").addEventListener("click",function(evt) {
			evt.preventDefault();
			evt.stopPropagation();

			div.style.display = "none";
			content.style.display = "block";
		},false);

		content.parentNode.insertBefore(div,content);

	}
};