"use strict";

const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * network operations center asn service
 */

module.exports = {
	// name of service
	name: "noc.asns",
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
			permissions: 'noc.asns'
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
			asn: {
				type: "string",
				required: true
			},
			name: {
				type: "string",
				required: true,
				trim: true,
			},

			// resgitered date
			registered: {
				type: "number",
				required: false
			},

			updated: {
				type: "number",
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
		 * lookup asn
		 * 
		 * @param {number|String} asn - asn to lookup
		 * 
		 * @returns {object} asn record
		 */
		lookup: {
			rest: {
				method: "GET",
				path: "/lookup/:asn"
			},
			params: {
				asn: [{
					type: "number",
					convert: true
				}, {
					type: "string",
					convert: true
				}]
			},
			async handler(ctx) {
				let asnNumber = ctx.params.asn;

				if (typeof asnNumber === 'string') {
					asnNumber = asnNumber.toLowerCase().replace('as', '');
				}

				let asn = await this.findEntity(null, {
					query: {
						asn: `AS${asnNumber}`
					}
				})

				if (!asn) {
					const result = await ctx.call('v1.utils.network.as', { as: `AS${asnNumber}` })
						.catch((err) => null);

					if (!result) {
						throw new MoleculerClientError('Invalid ASN', 422, 'INVALID_ASN', {
							asn: asnNumber
						});
					}
					// convert 1987-10-19 to date 
					const registered = new Date(result.RegDate).getTime();
					const updated = new Date(result.Updated).getTime();



					asn = await this.createEntity(ctx, {
						asn: `AS${asnNumber}`,
						name: result.ASName,
						registered: registered,
						updated: updated
					});
				}
				return asn;
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

	},

	/**
	 * service methods
	 */
	methods: {
		/**
		 * lookup asn
		 * 
		 * @param {object} ctx - context
		 * @param {number} asn - asn to lookup
		 * 
		 * @returns {object} asn record
		 */
		lookup(ctx, asn) {
			console.log(asn)
			return this.findEntity(null, {
				query: {
					asn: asn
				}
			});
		},
	}

}



