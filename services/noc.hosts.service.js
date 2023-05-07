

const C = require("../constants");

const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError } = require("moleculer").Errors;


const dns = require("dns").promises;
const Lock = require('../lib/lock')
const geoip = require('geoip-lite');
/**
 * Addons service
 */
module.exports = {
	name: "noc.hosts",
	version: 1,

	mixins: [
		DbService({
			entityChangedEventMode: 'emit'
		}),
		ConfigLoader(['noc.**']),
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Service settings
	 */
	settings: {
		rest: "/v1/noc/hosts",


		indexes: {
			fields: {
				hostname: "text"
			}
		},
		fields: {
			id: {
				type: "string",
				primaryKey: true,
				secure: true,
				columnName: "_id"
			},
			network: {
				type: "string",
				empty: false,
				populate: {
					action: "v1.noc.networks.resolve",
					params: {
						//fields: ["id", "username", "fullName", "avatar"]
					}
				}
			},
			ip: {
				type: "string",
				required: true
			},
			hostname: {
				type: "string",
				required: true
			},

			ipInt: {
				type: "number",
				set: function ({ params }) {
					return this.ip2int(params.ip)
				},
				required: false
			},

			hits: {
				type: "number",
				default: 0,
				required: false
			},
			score: {
				type: "number",
				default: 0,
				required: false
			},

			options: { type: "object" },
			...C.ARCHIVED_FIELDS,
			...C.TIMESTAMP_FIELDS
		},
		defaultPopulates: [],

		scopes: {

			// List the non-archived addons
			notArchived: { archived: false },

			// List the not deleted addons
			notDeleted: { deletedAt: null },

		},

		defaultScopes: ["notArchived", "notDeleted"]
	},

	/**
	 * Actions
	 */
	actions: {
		create: {
			permissions: ['vpns.create'],
			params: {

			}
		},
		list: {
			permissions: ['vpns.list'],
			params: {

			}
		},
		find: {
			rest: "GET /find",
			permissions: ['vpns.find'],
			params: {

			}
		},
		count: {
			rest: "GET /count",
			permissions: ['vpns.count'],
			params: {

			}
		},
		get: {
			needEntity: true,
			permissions: ['vpns.get'],
			params: {

			}
		},
		update: {
			needEntity: true,
			permissions: ['vpns.update'],
			params: {

			}
		},
		replace: false,
		remove: {
			needEntity: true,
			permissions: ['vpns.remove'],
			params: {

			}
		},
		reverse: {
			params: {
				ip: { type: "string", optional: false },
				mtr: { type: "boolean", default: false, optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const resolver = new dns.Resolver()
				resolver.setServers([
					'1.1.1.1',
					'4.4.4.4']);

				return resolver.reverse(params.ip).then((res) => {
					console.log('dns', res)

					return res;
				})
			}
		},
		lookup: {
			params: {
				ip: { type: "string", optional: false },
				mtr: { type: "boolean", default: false, optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);


				await this.lock.acquire()
				let host = await this.findEntity(null, {
					query: {
						ip: params.ip
					}
				})
				if (host) {
					host = await this.updateEntity(null, {
						id: host.id,
						$inc: { hits: 1 },
						$set: { updatedAt: Date.now() }
					}, { raw: true })
					await this.lock.release()
					return host
				}


				let network = await ctx.call('v1.noc.networks.lookup', {
					ip: params.ip
				})

				const hostname = await ctx.call('v1.noc.hosts.reverse', {
					ip: params.ip
				})
					.catch((err) => console.log(err))
					.then((res) => {
						if (res) {
							return res.shift()
						}
						return ''
					})

				if (!network) {
					network = await ctx.call('v1.noc.networks.lookup', {
						ip: params.ip
					})
				}
				if (!network) {
					await this.lock.release()
					return host;

				}


				host = await this.createEntity(null, {
					ip: params.ip,
					network: network.id,
					hostname,
					hits: 1
				})
				await this.lock.release()

				return host
			}
		},
		score: {
			params: {
				id: { type: "string", optional: false },
				score: { type: "number", default: false, optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);


				let host = await this.resolveEntities(null, {
					id: params.id
				})
				if (host) {
					return this.updateEntity(null, {
						id: host.id,
						$inc: { score: params.score }
					}, { raw: true })
				}

				return host
			}
		},

		aggLocations: {
			params: {

			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const stream = await this.streamEntities(null, {
					limit: 1000
				});
				const result = {}
				stream.on('data', (data) => {
					const geo = geoip.lookup(data.ip)

					if (!result[geo.country]) {
						result[geo.country] = {}
					}
					if (!result[geo.country][geo.region]) {
						result[geo.country][geo.region] = {
							country: geo.country,
							region: geo.region,
							timezone: geo.timezone,
							ll: geo.ll,
							size: 0
						}
					}

					result[geo.country][geo.region].size++

				})
				return new Promise((resolve, reject) => {
					stream.once('end', () => resolve(result))
				})
				return result
			}
		},
		mtr: {
			params: {
				ip: { type: "string", optional: false },
				nodeID: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const mtr = await ctx.call('v1.node.cmd', {
					cmd: `mtr -rwj -n ${params.ip}`
				}, { nodeID: params.nodeID }).then((res) => JSON.parse(res.stdout).report)

				const hubs = mtr.hubs.filter((res) => res.host != '???')


				return Promise.all(hubs.map(async (hub) => {
					hub.host = await ctx.call('v1.noc.hosts.lookup', { ip: hub.host }).catch(() => hub.host);
					return hub
				}))
			}
		},

	},

	/**
	 * Events
	 */
	events: {


		async "routes.created"(ctx) {
			const route = ctx.params.data;

		},

	},

	/**
	 * Methods
	 */
	methods: {
		async validateHasNode(query, ctx, params) {
			// Adapter init
			if (!ctx) return query;

			if (params.node) {
				const res = await ctx.call("v1.nodes.resolve", {
					id: params.node
				});

				if (res) {
					query.node = params.node;
					return query;
				}
				throw new MoleculerClientError(
					`You have no right for the node '${params.node}'`,
					403,
					"ERR_NO_PERMISSION",
					{ node: params.node }
				);
			}
			if (ctx.action && ctx.action.params.node && !ctx.action.params.node.optional) {
				throw new MoleculerClientError(`node is required`, 422, "VALIDATION_ERROR", [
					{ type: "required", field: "node" }
				]);
			}
		},
		exec(ctx, cmd, nodeID) {
			return ctx.call('v1.node.cmd', {
				cmd
			}, { nodeID }).then((res) => {

				if (res.stdout.length) {
					return res.stdout
				}
				return res.stderr
			})
		},
		ip2int(ip) {
			return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
		},
		int2ip(ipInt) {
			return ((ipInt >>> 24) + '.' + (ipInt >> 16 & 255) + '.' + (ipInt >> 8 & 255) + '.' + (ipInt & 255));
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() { },

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		this.lock = new Lock()

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() { }
};