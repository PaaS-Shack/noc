const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const C = require("../constants");

const whoiser = require('whoiser');

const { MoleculerClientError } = require("moleculer").Errors;
const Lock = require('../lib/lock')

/**
 * Addons service
 */
module.exports = {
	name: "noc.networks",
	version: 1,

	mixins: [
		DbService({
			entityChangedEventMode: 'emit'
		}),
		ConfigLoader(['noc.**'])
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Service settings
	 */
	settings: {
		rest: "/v1/noc/networks",

		indexes: {
			fields: {
				name: "text",
				description: "text"
			}
		},
		fields: {
			id: {
				type: "string",
				primaryKey: true,
				secure: true,
				columnName: "_id"
			},
			asns: {

				type: "array",
				items: { type: "string", empty: false },
				populate: {
					action: "v1.noc.asns.resolve",
					params: {
						//fields: ["id", "username", "fullName", "avatar"]
					}
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
			created: {
				type: "number",
				required: false
			},
			updated: {
				type: "number",
				required: false
			},


			options: { type: "object" },
			...C.TIMESTAMP_FIELDS
		},
		defaultPopulates: [],

		scopes: {
			notDeleted: { deletedAt: null },
		},

		defaultScopes: ["notDeleted"]
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

		lookup: {
			params: {
				ip: { type: "string", optional: false },
				create: { type: "boolean", default: true, optional: true },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);

				await this.lock.acquire(ctx)

				const int = this.ip2int(params.ip)
				const found = await this.findEntity(null, {
					query: {
						$and: [
							{ "rangeHigh": { $gte: int } },
							{ "rangeLow": { $lte: int } }]
					}
				}, { raw: true })

				if (found) {
					await this.lock.release(ctx)
					return found;
				}
				return this.lookup(ctx, params.ip)
					.catch(() => this.lock.release(ctx))
					.then((res) => this.lock.release(ctx).then(() => res))
			}
		},

		range: {
			params: {
				ip: { type: "string", optional: false },
			},
			async handler(ctx) {
				const params = Object.assign({}, ctx.params);
				const int = this.ip2int(params.ip)

				return this.findEntities(null, {
					query: {
						$and: [
							{ "rangeHigh": { $gte: int } },
							{ "rangeLow": { $lte: int } }]
					}
				}, { raw: true })

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
		async lookup(ctx, ip) {

			let entity;


			const res = await whoiser.ip(ip, {})

			if (!res.range) return entity
			const rangeHigh = res.range.split(' - ')[1]
			const rangeLow = res.range.split(' - ')[0]

			const asnNumbers = res.asn ? res.asn.split(',').map((s) => s.trim()) : []



			const promises = []

			for (let index = 0; index < asnNumbers.length; index++) {
				const asnNumber = Number(asnNumbers[index].replace('AS', ''));
				promises.push(ctx.call('v1.noc.asns.lookup', {
					asn: asnNumber
				}))
			}

			const asns = await Promise.all(promises).then((res) => res.map((asn) => asn.id))
			const data = {
				name: res.netname || res.NetName,
				description: res.descr || res.Organization,
				rangeHighIP: rangeHigh,
				rangeLowIP: rangeLow,
				asns
			}

			if (res.created || res.RegDate) {
				data.created = new Date(res.created || res.RegDate)
			}
			if (res['last-modified'] || res.Updated) {
				data.updated = new Date(res['last-modified'] || res.Updated)
			}

			entity = await this.createEntity(ctx, data)
			this.logger.info(`New network found ${entity.name}  ${entity.rangeLowIP} - ${entity.rangeHighIP} ${entity.id}`);

			return entity

		},
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
	created() {
		this.lock = new Lock()
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() { }
};