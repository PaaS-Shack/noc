"use strict";

const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * network operations center network service
 */

module.exports = {
	// name of service
	name: "noc.networks",
	// version of service
	version: 1,

	/**
	 * Service Mixins
	 * 
	 * @type {Array}
	 * @property {DbService} DbService - Database mixin
	 * @property {ConfigLoader} ConfigLoader - Config loader mixin
	 */
	mixins: [
		DbService({
			permissions: 'noc.networks'
		}),
		ConfigLoader(['noc.**']),
	],

	/**
	 * Service dependencies
	 */
	dependencies: [
		'v1.utils.network'
	],

	/**
	 * Service settings
	 * 
	 * @type {Object}
	 */
	settings: {
		rest: true,

		fields: {
			asns: {

				type: "array",
				items: { type: "string", empty: false },
				populate: {
					action: "v1.noc.asns.resolve"
				}
			},

			hosts: {
				type: 'array',
				virtual: true,
				populate(ctx = this.broker, values, entities, field) {
					if (!ctx) return null
					return Promise.all(
						entities.map(async entity => {
							return ctx.call('v1.noc.hosts.find', {
								query: { network: this.encodeID(entity._id), },
							})
						})
					);
				}
			},
			name: {
				type: "string",
				required: true
			},
			description: {
				type: "string",
				required: false,
				trim: true,
			},
			source: {
				type: "string",
				required: false,
				trim: true,
			},
			rangeHigh: {
				type: "number",
				set: function ({ params }) {
					if (params.rangeHighIP) return this.ip2int(params.rangeHighIP)
				},
				required: false
			},
			rangeLow: {
				type: "number",
				set: function ({ params }) {
					if (params.rangeLowIP) return this.ip2int(params.rangeLowIP)
				},
				required: false
			},
			rangeHighIP: {
				type: "string",
				required: false
			},
			rangeLowIP: {
				type: "string",
				required: false
			},

			...DbService.FIELDS,// inject dbservice fields
		},

		// default database populates
		defaultPopulates: [],

		// database scopes
		scopes: {
			...DbService.SCOPE,// inject dbservice scope
		},

		// default database scope
		defaultScopes: [...DbService.DSCOPE],// inject dbservice dscope

		// default init config settings
		config: {

		}
	},

	/**
	 * service actions
	 */
	actions: {
		/**
		 * resolve network from ip
		 * This action analyzes the ip address and returns the network information
		 * 
		 * @actions
		 * @param {string} ip - ip address to resolve
		 * @param {string} source - source of ip address eg. proxy, dns, email, etc
		 * 
		 * @returns {object} network object
		 */
		lookup: {
			rest: {
				method: "GET",
				path: "/lookup/:ip"
			},
			params: {
				ip: { type: "string", empty: false },
				source: { type: "string", empty: false, default: 'whois' },
			},
			async handler(ctx) {
				const { ip, source } = ctx.params;
				const intIP = this.ip2int(ip);

				let network = await this.findEntity(ctx, {
					query: {
						$and: [
							{ "rangeHigh": { $gte: intIP } },
							{ "rangeLow": { $lte: intIP } }]
					}
				}, { raw: true });

				// create network if not found
				if (!network) {
					const result = await this.resolveNetwork(ctx, ip);

					if (!result) {
						this.logger.warn(`Unable to resolve network for ${ip}`);
						return;
					} else {

						const lowRange = result.range.split('-')[0].trim();
						const highRange = result.range.split('-')[1].trim();
						network = await this.createEntity(ctx, {
							name: result.name,
							description: result.description,
							source: source,
							rangeLowIP: lowRange,
							rangeHighIP: highRange,
						});
					}
				}

				// lookup asn
			}
		},

		clean: {
			params: {},
			async handler(ctx) {
				const entities = await this.findEntities(ctx, { scope: false })
				console.log(entities)
				return Promise.allSettled(entities.map((entity) =>
					this.removeEntity(ctx, { scope: false, id: entity.id })))
			}
		},
	},

	/**
	 * service events
	 */
	events: {
		/**
		 * noc.http event
		 */
		async "noc.http"(ctx) {
			const ip = ctx.params.ip;
			console.log(ip)
			await ctx.call('v1.utils.lock.acquire', { key: `noc.networks.lookup.${ip}` });
			const res = await ctx.call('v1.noc.networks.lookup', { ip })
				.catch((err) => {
					console.log(err)
					return null
				});
			await ctx.call('v1.utils.lock.release', { key: `noc.networks.lookup.${ip}` });
			console.log(res)
		}
	},

	/**
	 * service methods
	 */
	methods: {
		/**
		 * resolve network from ip
		 * 
		 * @param {object} ctx - context
		 * @param {string} ip - ip address to resolve
		 * 
		 * @returns {object} network object
		 */
		async resolveNetwork(ctx, ip) {

			const lookup = await ctx.call('v1.utils.network.ip', { ip })

			if (!lookup) return null;

			return {
				ip,
				range: lookup.range,
				name: lookup.netname || lookup.NetName,
				description: lookup.descr,
				organisation: lookup.org,
				status: lookup.status,
				route: lookup.route,
				asn: lookup.asn,
			}
		},
		/**
		 * lookup network by ip
		 * 
		 * @param {string} ip - ip address to lookup
		 * 
		 * @returns {object} network object
		 */
		async lookup(ip) {
			let ipInt = this.ip2int(ip)
			const network = await this.findEntity(null, {
				query: {
					$and: [
						{ "rangeHigh": { $gte: ipInt } },
						{ "rangeLow": { $lte: ipInt } }]
				}
			}, { raw: true });
			return network;
		},
		/**
		 * ip to int
		 * 
		 * @param {string} ip
		 * 
		 * @returns {number} ip as int
		 */
		ip2int(ip) {
			return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
		},

		/**
		 * int to ip
		 * 
		 * @param {number} ipInt
		 * 
		 * @returns {string} ip as string
		 */
		int2ip(ipInt) {
			return ((ipInt >>> 24) + '.' + (ipInt >> 16 & 255) + '.' + (ipInt >> 8 & 255) + '.' + (ipInt & 255));
		}
	}

}



