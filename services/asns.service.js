const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const whoiser = require('whoiser');
const { Context } = require("moleculer");

const ASN = {
    ASNumber: '11120',
    ASName: 'ISYS-LLC',
    ASHandle: 'AS11120',
    RegDate: '2008-12-04',
    Updated: '2022-06-28',
    Ref: 'https://rdap.arin.net/registry/autnum/11120',
    organisation: {
        OrgName: 'WidePoint Integrated Solutions Corp.',
        OrgId: 'ISYSL',
        Address: '8351 N High St Ste 200',
        City: 'Columbus',
        StateProv: 'OH',
        PostalCode: '43235',
        Country: 'US',
        RegDate: '2008-09-29',
        Updated: '2022-06-28',
        Ref: 'https://rdap.arin.net/registry/entity/ISYSL'
    },
    contactTechnical: {
        RTechHandle: 'METZL19-ARIN',
        RTechName: 'Metzler, John',
        RTechPhone: '+1-703-349-5644',
        RTechEmail: 'jmetzler@widepoint.com',
        RTechRef: 'https://rdap.arin.net/registry/entity/METZL19-ARIN'
    },
    contactAbuse: {
        OrgAbuseHandle: 'METZL19-ARIN',
        OrgAbuseName: 'Metzler, John',
        OrgAbusePhone: '+1-703-349-5644',
        OrgAbuseEmail: 'jmetzler@widepoint.com',
        OrgAbuseRef: 'https://rdap.arin.net/registry/entity/METZL19-ARIN'
    },
    text: [
        '#',
        '# ARIN WHOIS data and services are subject to the Terms of Use',
        '# available at: https://www.arin.net/resources/registry/whois/tou/',
        '#',
        '# If you see inaccuracies in the results, please report at',
        '# https://www.arin.net/resources/registry/whois/inaccuracy_reporting/',
        '#',
        '# Copyright 1997-2023, American Registry for Internet Numbers, Ltd.',
        '#',
        '#',
        '# ARIN WHOIS data and services are subject to the Terms of Use',
        '# available at: https://www.arin.net/resources/registry/whois/tou/',
        '#',
        '# If you see inaccuracies in the results, please report at',
        '# https://www.arin.net/resources/registry/whois/inaccuracy_reporting/',
        '#',
        '# Copyright 1997-2023, American Registry for Internet Numbers, Ltd.',
        '#'
    ]
}

/**
 * Network Operation Center - ASNs (Autonomous System Numbers)
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
        DbService({}),
        ConfigLoader([
            'noc.**'
        ]),
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     * 
     * @type {Object}
     */
    settings: {
        rest: true,

        fields: {

            // ASN number
            number: {
                type: "number",
                required: true,
            },

            // ASN name
            name: {
                type: "string",
                required: true,
            },

            // ASN description
            description: {
                type: "string",
                required: true,
            },

            // ASN organization
            organization: {
                type: "string",
                required: true,
            },

            // networks
            networks: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.noc.networks.resolve",
                }
            },

            ...DbService.FIELDS,// inject dbservice fields
        },
        defaultPopulates: [],

        scopes: {
            ...DbService.SCOPE,
        },

        defaultScopes: [
            ...DbService.DSCOPE,
        ],

        // default init config settings
        config: {

        }
    },

    /**
     * service actions
     */
    actions: {
        /**
         * lookup ASN by number from whois server
         * 
         * @actions
         * @param {Number} number - ASN number
         * 
         * @returns {Object} ASN
         */
        lookup: {
            rest: {
                method: "GET",
                path: "/:number",
            },
            params: {
                number: {
                    type: "number",
                    required: true,
                },
            },
            async handler(ctx) {
                // get asn
                const asn = await this.lookup(ctx, ctx.params.number);

                // return asn
                return asn;
            }
        },

        /**
         * add network to ASN
         * 
         * @actions
         * @param {String} id - ASN id
         * @param {String} network - network id
         * 
         * @returns {Object} ASN
         */
        addNetwork: {
            rest: {
                method: "POST",
                path: "/:id/networks/:network",
            },
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                network: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // update asn
                const asn = await this.addNetwork(ctx, ctx.params.id, ctx.params.network);

                // return asn
                return asn;
            }
        },

        /**
         * remove network from ASN
         * 
         * @actions
         * @param {String} id - ASN id
         * @param {String} network - network id
         * 
         * @returns {Object} ASN
         */
        removeNetwork: {
            rest: {
                method: "DELETE",
                path: "/:id/networks/:network",
            },
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                network: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // update asn
                const asn = await this.removeNetwork(ctx, ctx.params.id, ctx.params.network);

                // return asn
                return asn;
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
         * get ASN by number
         * 
         * @param {Number} number - ASN number
         * 
         * @returns {Object} ASN
         */
        async getASN(number) {
            // get asn
            const asn = await this.findEntity(null, {
                query: {
                    number: number,
                }
            });

            // return asn
            return asn;
        },

        /**
         * lookup ASN by number from whois server
         * if found create new ASN entity
         * 
         * @param {Context} ctx - context
         * @param {Number} number - ASN number
         * 
         * @returns {Object} ASN
         */
        async lookup(ctx, number) {
            // look in db
            let asn = await this.getASN(number);

            // if not found
            if (asn) {
                return asn;
            }

            // lookup asn
            const lookup = await ctx.call('v1.utils.network.asn', {
                asn: `AS${number}`
            })

            // check for "as-block"
            if (lookup['as-block']) {
                // get block
                const blockLow = parseInt(lookup['as-block'].split(' - ')[0].replace('AS', ''));
                const blockHigh = parseInt(lookup['as-block'].split(' - ')[1].replace('AS', ''));
                // loop through block
                for (let i = blockLow; i <= blockHigh; i++) {
                    const number = i;
                    const found = await this.getASN(number);

                    // if not found
                    if (!found) {
                        asn = await this.createEntity(null, {
                            number: number,
                            name: lookup.descr,
                            description: lookup.descr,
                            organization: lookup.org,
                        });
                    }
                }
            } else {
                // create asn
                asn = await this.createEntity(null, {
                    number: lookup.ASNumber,
                    name: lookup.ASName,
                    description: lookup.ASName,
                    organization: lookup.$addToSet,
                });
            }


            this.logger.info(`created asn ${asn.number} ${asn.name} ${asn.organization}`)

            // return asn
            return asn;
        },

        /**
         * add network to ASN
         * 
         * @param {Context} ctx - context
         * @param {String} id - ASN id
         * @param {String} networkId - network id
         * 
         * @returns {Object} ASN
         */
        async addNetwork(ctx, id, networkId) {
            // update asn
            const asn = await this.updateEntity(ctx, {
                id: id,
                $addToSet: {
                    networks: networkId,
                }
            }, { raw: true });

            // return asn
            return asn;
        },

        /**
         * remove network from ASN
         * 
         * @param {Context} ctx - context
         * @param {String} id - ASN id
         * @param {String} networkId - network id
         * 
         * @returns {Object} ASN
         */
        async removeNetwork(ctx, id, networkId) {
            // update asn
            const asn = await this.updateEntity(ctx, {
                id: id,
                $pull: {
                    networks: networkId,
                }
            }, { raw: true });

            // return asn
            return asn;
        },
    },

    /**
     * service created lifecycle event handler
     */
    created() { },

    /**
     * service started lifecycle event handler
     */
    async started() { },

    /**
     * service stopped lifecycle event handler
     */
    async stopped() { },

}

