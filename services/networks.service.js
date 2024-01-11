const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const whoiser = require('whoiser');
const { Context } = require("moleculer");

/* {
    range: '1.1.1.0 - 1.1.1.255',
    netname: 'APNIC-LABS',
    descr: 'APNIC Research and Development\n6 Cordelia St',
    country: 'AU',
    org: 'ORG-ARAD1-AP',
    'admin-c': 'AIC3-AP',
    'tech-c': 'AIC3-AP',
    'abuse-c': 'AA1412-AP',
    status: 'ASSIGNED PORTABLE',
    remarks: 'All Cloudflare abuse reporting can be done via\n' +
        'resolver-abuse@cloudflare.com',
    'mnt-by': 'MAINT-APNICRANDNET',
    'mnt-routes': 'MAINT-APNICRANDNET',
    'mnt-irt': 'IRT-APNICRANDNET-AU',
    'last-modified': '2023-04-26T02:42:44Z',
    'mnt-lower': 'MAINT-APNICRANDNET',
    source: 'APNIC',
    contactAbuse: {
        irt: 'IRT-APNICRANDNET-AU',
        address: 'PO Box 3646\nSouth Brisbane, QLD 4101\nAustralia',
        'e-mail': 'helpdesk@apnic.net',
        'abuse-mailbox': 'helpdesk@apnic.net',
        'admin-c': 'AR302-AP',
        'tech-c': 'AR302-AP',
        auth: '# Filtered',
        remarks: 'helpdesk@apnic.net was validated on 2021-02-09',
        'mnt-by': 'MAINT-AU-APNIC-GM85-AP',
        'last-modified': '2021-03-09T01:10:21Z',
        source: 'APNIC'
    },
    organisation: {
        organisation: 'ORG-ARAD1-AP',
        'org-name': 'APNIC Research and Development',
        'org-type': 'LIR',
        country: 'AU',
        address: '6 Cordelia St',
        phone: '+61-7-38583100',
        'fax-no': '+61-7-38583199',
        'e-mail': 'helpdesk@apnic.net',
        'mnt-ref': 'APNIC-HM',
        'mnt-by': 'APNIC-HM',
        'last-modified': '2023-09-05T02:15:19Z',
        source: 'APNIC'
    },
    'Contact APNICRANDNETAU': {
        role: 'ABUSE APNICRANDNETAU',
        address: 'PO Box 3646\nSouth Brisbane, QLD 4101\nAustralia',
        country: 'ZZ',
        phone: '+000000000',
        'e-mail': 'helpdesk@apnic.net',
        'admin-c': 'AR302-AP',
        'tech-c': 'AR302-AP',
        'nic-hdl': 'AA1412-AP',
        remarks: 'Generated from irt object IRT-APNICRANDNET-AU',
        'abuse-mailbox': 'helpdesk@apnic.net',
        'mnt-by': 'APNIC-ABUSE',
        'last-modified': '2021-03-09T01:10:22Z',
        source: 'APNIC'
    },
    'Contact Infrastructure': {
        role: 'APNICRANDNET Infrastructure Contact',
        address: '6 Cordelia St\nSouth Brisbane\nQLD 4101',
        country: 'AU',
        phone: '+61 7 3858 3100',
        'e-mail': 'research@apnic.net',
        'admin-c': 'GM85-AP\nGH173-AP\nJD1186-AP',
        'tech-c': 'GM85-AP\nGH173-AP\nJD1186-AP',
        'nic-hdl': 'AIC3-AP',
        'mnt-by': 'MAINT-APNICRANDNET',
        'last-modified': '2023-04-26T22:50:54Z',
        source: 'APNIC'
    },
    route: '1.1.1.0/24',
    asn: 'AS13335',
    text: [
        '% [whois.apnic.net]',
        '% Whois data copyright terms    http://www.apnic.net/db/dbcopyright.html',
        "% Information related to '1.1.1.0 - 1.1.1.255'",
        "% Abuse contact for '1.1.1.0 - 1.1.1.255' is 'helpdesk@apnic.net'",
        "% Information related to '1.1.1.0/24AS13335'",
        '% This query was served by the APNIC Whois Service version 1.88.25 (WHOIS-US4)'
    ]
} */
/**
 * Network Operation Center - Networks
 * Here we track diffrent network ranges that we interact with.
 * Services like SSH, HTTP, SMTP, FTP, etc. will use this to determine if a connection is allowed.
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

            // network name
            name: {
                type: "string",
                required: true,
            },

            // network lower range
            lower: {
                type: "number",
                required: true,
            },

            // network upper range
            upper: {
                type: "number",
                required: true,
            },

            // network description
            description: {
                type: "string",
                required: false,
            },

            // network asns (autonomous system numbers)
            asns: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.noc.asns.get",
                }
            },

            // network discovered hosts
            hosts: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.noc.hosts.get",
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
         * lookup network by ip
         * 
         * @param {string} ip - ip address to lookup
         * 
         * @returns {object} network object
         */
        lookup: {
            rest: {
                method: "GET",
                path: "/lookup/:ip",
            },
            params: {
                ip: {
                    type: "string",
                    pattern: /^(\d{1,3}\.){3}\d{1,3}$/
                },
            },
            async handler(ctx) {
                return this.lookup(ctx, ctx.params.ip);
            }
        },

        /**
         * add asn to network
         * 
         * @param {string} id - network id
         * @param {string} asn - asn id
         * 
         * @returns {object} network object
         */
        addAsn: {
            rest: {
                method: "POST",
                path: "/:id/asns/:asn",
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                asn: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                return this.addAsn(ctx, ctx.params.id, ctx.params.asn);
            }
        },

        /**
         * remove asn from network
         * 
         * @param {string} id - network id
         * @param {string} asn - asn id
         * 
         * @returns {object} network object
         */
        removeAsn: {
            rest: {
                method: "DELETE",
                path: "/:id/asns/:asn",
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                asn: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                return this.removeAsn(ctx, ctx.params.id, ctx.params.asn);
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
         * lookup network by ip
         * 
         * @param {Context} ctx - context
         * @param {string} ip - ip address to lookup
         * 
         * @returns {object} network object
         */
        async lookup(ctx, ip) {
            const ipInt = this.ip2int(ip);

            let network = await this.findEntity(null, {
                query: {
                    $and: [
                        { "lower": { $lte: ipInt } },
                        { "upper": { $gte: ipInt } },
                    ]
                }
            }, { raw: true });

            // check if network was found
            if (!network) {
                // lookup network
                const lookup = await this.whois(ctx, ip);

                // create network
                network = await this.createEntity(ctx, {
                    name: lookup.name,
                    lower: lookup.lower,
                    upper: lookup.upper,
                    description: lookup.description,
                });

                this.logger.info(`Created network ${network.name} (${this.int2ip(network.lower)} - ${this.int2ip(network.upper)})`);

                // lookup asns on next tick
                setImmediate(async () => {
                    for (let asn of lookup.asns) {
                        const number = parseInt(asn.replace('AS', ''));
                        // lookup asn
                        const asnObj = await ctx.call("v1.noc.asns.lookup", { number });

                        // check if asn was found
                        if (asnObj) {
                            // add asn to network
                            await this.addAsn(ctx, network.id, asnObj.id);
                        } else {
                            this.logger.warn(`ASN ${asn}(${number}) not found`);
                        }
                    }
                });
            }

            return network;
        },

        /**
         * add asn to network
         * 
         * @param {Context} ctx - context
         * @param {string} networkId - network id
         * @param {string} asnId - asn id
         * 
         * @returns {object} network object
         */
        async addAsn(ctx, networkId, asnId) {

            // add asn to network
            const network = await this.updateEntity(ctx, {
                id: networkId,
                $addToSet: {
                    asns: asnId,
                }
            }, { raw: true });

            // add network to asn
            await ctx.call("v1.noc.asns.addNetwork", { id: asnId, network: networkId });

            // return network
            return network;
        },

        /**
         * remove asn from network
         * 
         * @param {Context} ctx - context
         * @param {string} networkId - network id
         * @param {string} asnId - asn id
         * 
         * @returns {object} network object
         */
        async removeAsn(ctx, networkId, asnId) {

            // remove asn from network
            const network = await this.updateEntity(ctx, {
                id: networkId,
                $pull: {
                    asns: asnId,
                }
            });

            // remove network from asn
            await ctx.call("v1.noc.asns.removeNetwork", { id: asnId, network: networkId });

            // return network
            return network;
        },

        /**
         * whois lookup
         * 
         * @param {Context} ctx - context
         * @param {string} ip - ip address to lookup
         * 
         * @returns {object} network object
         */
        async whois(ctx, ip) {
            // lookup network
            const network = await ctx.call("v1.utils.network.ip", { ip });

            // check if network was found
            if (!network) {
                // throw error
                throw new MoleculerServerError("Network not found", 404, "NETWORK_NOT_FOUND", { ip });
            }

            // create result
            const result = {
                name: network.netname,
                lower: this.ip2int(network.range.split(' - ')[0]),
                upper: this.ip2int(network.range.split(' - ')[1]),
                description: network.descr,
                asns: []
            };

            if (network.asn) {
                result.asns.push(...network.asn.split(' ').filter(asn => asn.startsWith('AS')));
            }

            // return result
            return result;
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

