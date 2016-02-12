// ==================================
// APP 1 - incoming messages, look for type
// ==================================
var obc = {};
var chaincode = {};
var last_blockheight = 0;
var pollInt = null;
var async = require('async');

module.exports.setup = function(sdk, cc){
	obc = sdk;
	chaincode = cc;
};

module.exports.process_msg = function(ws, data){
	if(data.v === 2){
		if(data.type == 'create'){
			console.log('its a create!');
			if(data.name && data.color && data.size && data.user){
				chaincode.init_marble([data.name, data.color, data.size, data.user], cb_invoked);				//create a new marble
				ledger_edit();
			}
		}
		else if(data.type == 'get'){
			console.log('get marbles msg');
			get_marbles();
		}
		else if(data.type == 'transfer'){
			console.log('transfering msg');
			if(data.name && data.user){
				chaincode.set_user([data.name, data.user]);
				ledger_edit();
			}
		}
		else if(data.type == 'remove'){
			console.log('removing msg');
			if(data.name){
				chaincode.remove(data.name);
				ledger_edit();
			}
		}
		else if(data.type == 'chainstats'){
			console.log('chainstats msg');
			obc.chain_stats(cb_chainstats);
		}
		else if(data.type == 'open_trade'){
			console.log('open_trade msg');
			if(!data.willing || data.willing.length < 0){
				console.log('error, "willing" is empty');
			}
			else if(!data.want){
				console.log('error, "want" is empty');
			}
			else{
				var args = [data.user, data.want.color, data.want.size, data.willing[0].color, data.willing[0].size];
				chaincode.open_trade(args);
			}
			ledger_edit();
		}
		else if(data.type == 'get_open_trades'){
			console.log('get_open_trades msg');
			chaincode.read('_opentrades', cb_got_trades);
		}
		else if(data.type == 'perform_trade'){
			console.log('perform_trade msg');
			chaincode.perform_trade([data.id, data.closer.user, data.closer.name, data.opener.user, data.opener.color, data.opener.size], cb_test);
			ledger_edit();
		}
		
		/*
		if(pollInt === null){																			//monitor blockchain for events
			pollInt = setInterval(function(){
				console.log('polling on block height');
				obc.chain_stats(cb_chainstats);
			}, 15000);
		}
		*/
	}
	
	function cb_test(e, d){
		console.log('?', e, d);
	}
	
	function ledger_edit(skip_chainstats){																//there was a ledger edit action, lets refresh all the things
		console.log('- ledger edit');
		sendMsg({msg: 'reset'});																		//msg to clear the page
		setTimeout(function(){
			if(!skip_chainstats) obc.chain_stats(cb_chainstats);
		}, 300);																						//wait long enough for it to take effect
		
		setTimeout(function(){
			chaincode.read('_opentrades', cb_got_trades);
		}, 600);
		
		setTimeout(function(){
			get_marbles();
		}, 900);
	}
	
	function get_marbles(){
		console.log('fetching all marble data');
		chaincode.read('marbleIndex', cb_got_index);
	}
	
	function cb_got_index(e, index){
		if(e != null) console.log('error:', e);
		else{
			try{
				var json = JSON.parse(index);
				var keys = Object.keys(json);
				var concurrency = 1;

				//TEST3: TESTING WITH CONCURRENCY, FAILS SOMETIMES MULTIPLE CALLS OVERLAP
				async.eachLimit(keys, concurrency, function(key, cb) {
					console.log('!', json[key]);
					chaincode.read(json[key], function(e, marble) {
						if(e != null) console.log('error:', e);
						else {
							sendMsg({msg: 'marbles', e: e, marble: marble});
							cb(null);
						}
					});
				}, function() {
					sendMsg({msg: 'action', e: e, status: 'finished'});
				});
				/*for(var i in json){
					console.log('!', i, json[i]);
					chaincode.read(json[i], cb_got_marble);												//iter over each, read their values
				}*/
			}
			catch(e){
				console.log('error:', e);
			}
		}
	}
	
	function cb_got_marble(e, marble){
		if(e != null) console.log('error:', e);
		else {
			sendMsg({msg: 'marbles', marble: marble});
		}
	}
	
	function cb_invoked(e, a){
		console.log('response: ', e, a);
	}
	
	var chain_stats = {};
	function cb_chainstats(e, stats){
		//console.log('stats', stats.height);
		chain_stats = stats;
		if(stats && stats.height){
			if(last_blockheight != stats.height) {
				console.log('! new block', stats.height);
				last_blockheight = stats.height;
				//ledger_edit(true);
			}
			obc.block_stats(stats.height - 1, cb_blockstats);
		}
	}

	function cb_blockstats(e, stats){
		//console.log('replying', stats);
		sendMsg({msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats});
	}
	
	
	function cb_got_trades(e, trades){
		if(e != null) console.log('error:', e);
		else {
			if(trades && trades.open_trades){
				sendMsg({msg: 'open_trades', open_trades: trades.open_trades});
			}
		}
	}
	
	
	
	function sendMsg(json){
		try{
			ws.send(JSON.stringify(json));
		}
		catch(e){
			console.log('error ws', e);
		}
	}
};

module.exports.close = function(){
	/*
	clearInterval(pollInt);
	pollInt = null;
	console.log('closed ws');
	*/
};