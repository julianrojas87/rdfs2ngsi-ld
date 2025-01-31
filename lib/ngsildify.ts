import { JsonLdContext } from "jsonld-context-parser";
import { mapType } from "./context_mapper";
import { mapCapacity } from "./capacity_mapper";
const { parse } = require('wkt');

export interface NgsildifyOptions {
    versionOfPath?: string,
    timestampPath?: string
}
export class Ngsildify {
    private resultArray: any = [];
    private jsonLdContext: JsonLdContext = "";
    private timestampPath: string = "http://www.w3.org/ns/prov#generatedAtTime";
    private versionOfPath: string = "http://purl.org/dc/terms/isVersionOf";
    private observedAt: string;

    public constructor(options?: NgsildifyOptions) {
        if (options && options.timestampPath) this.timestampPath = options.timestampPath;
        if (options && options.versionOfPath) this.versionOfPath = options.versionOfPath;
    }

    public async transform(input: any): Promise<any[]> {
        this.resultArray = [];
        let context: any = {
            "@context": [
                "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
            ],
        };
        let rootObjects: any[] = [];

        // Check if it is temporal entity and extract value
        if (input[this.timestampPath]) {
            const ts = input[this.timestampPath];
            if (typeof ts === "string") {
                this.observedAt = ts;
            } else if (typeof ts === "object" && ts["@value"]) {
                this.observedAt = ts["@value"];
            }
        }

        if (Array.isArray(input)) {
            for (let obj of input) {
                // reset context on new object!
                context = {
                    "@context": [
                        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
                    ],
                };
                if (typeof obj === "object") {
                    if (obj["@context"]) {
                        // Add context from input to result
                        context["@context"] = context["@context"].concat(obj["@context"]);
                    }
                    // Set context to be used across entities
                    this.jsonLdContext = context["@context"];

                    // If isVersionOf and timestamp, materialize object with observedAt
                    if (obj[this.versionOfPath]) {
                        obj = this.materializeObject(obj);
                    }
                    const tempHandleRoot = await this.handleRoot(obj);
                    if (tempHandleRoot != null) {
                        rootObjects.push(tempHandleRoot);
                    }
                }
            }
        } else {
            if (input["@context"] && !context["@context"].includes(input["@context"])) {
                // Add context from input to result
                context["@context"] = context["@context"].concat(input["@context"]);
            }
            // Set context to be used across entities
            this.jsonLdContext = context["@context"];
            // If isVersionOf, materialize object
            if (input[this.versionOfPath]) {
                input = this.materializeObject(input);
            }
            const tempHandleRoot = await this.handleRoot(input);
            if (tempHandleRoot != null)
                rootObjects.push(tempHandleRoot);
        }
        this.resultArray.push(...rootObjects);
        return mapCapacity(this.resultArray)
    }

    protected async handleRoot(input: any): Promise<any> {
        if (typeof input === "object" && (input["@id"] || input["id"])) {
            const id = this.getIdFromValue(input, "", "", 1);

            let result: any = {
                "@context": this.jsonLdContext,
            };

            for (const [key, value] of Object.entries(input)) {
                if (key != "@context") {
                    if (Array.isArray(value) && key != "@type" && key != "type") {
                        let expandedValueResult = [];
                        for (let v in value)
                            expandedValueResult.push(await this.handleValue(value[v], id, key, parseInt(v)));
                        result[key] = expandedValueResult;
                    } else if (key === "id") {
                        result[key] = value;
                        if (this.observedAt) result['observedAt'] = this.observedAt;
                    } else if (key === "@id") {
                        result["id"] = value;
                        delete result["@id"];
                        if (this.observedAt) result['observedAt'] = this.observedAt;
                    } else if (key === "type") {
                        result[key] = value;
                    } else if (key === "@type") {
                        if (typeof value === "string") {
                            result["type"] = mapType(value);
                          } else {
                            result["type"] = value;
                          }
                        delete result["@type"];
                    } else {
                        const mappedKey = mapType(key);
                        result[mappedKey] = await this.handleValue(value, id, mappedKey, 1);
                        // Add transformation of WKT to GeoJSON
                        if (key === "http://www.opengis.net/ont/geosparql#asWKT") {
                            const v2 = <any>value;
                            if (v2 && (v2['@value'] || v2['value'])) {
                                let v = v2['@value'] ? v2['@value'] : (v2['value'] ? v2['value'] : '');
                                // Remove CRS
                                v = this.removeCRS(v);
                                const geoJSON = parse(v);
                                result["location"] = {
                                    "type": "GeoProperty",
                                    "value": geoJSON
                                }
                            }
                        }
                        if (key === "https://parktrack.geosparc.com/parkingBay/geometry") {
                            let v2 = <string>value;
                            // Remove CRS
                            v2 = this.removeCRS(v2);
                            const geoJSON = parse(v2);
                            if (geoJSON) {
                                result["location"] = {
                                    "type": "GeoProperty",
                                    "value": geoJSON
                                }
                            }
                        }
                    }
                }
            }
            if (!result["type"] && !result["@type"]) {
                result["type"] = "Entity"; // fallback when no type or @type found
            }
            return result;
        }
        return input;
    }

    private materializeObject(input: any): any {
        const materializedObject = Object.assign({}, input);

        if (materializedObject[this.versionOfPath]['id']) {
            materializedObject["id"] = materializedObject[this.versionOfPath]['id'];
        } else if (materializedObject[this.versionOfPath]['@id']) {
            materializedObject["id"] = materializedObject[this.versionOfPath]['@id'];
        } else {
            materializedObject["id"] = materializedObject[this.versionOfPath];
        }
        
        // Delete version metadata
        delete materializedObject[this.versionOfPath];

        if (materializedObject['@id']) {
            delete materializedObject['@id'];
        }

        if (materializedObject[this.timestampPath]) {
            if (materializedObject[this.timestampPath]['value']) {
                this.observedAt = materializedObject[this.timestampPath]['value'];
            } else if (materializedObject[this.timestampPath]['@value']) {
                this.observedAt = materializedObject[this.timestampPath]['@value'];
            } else {
                this.observedAt = materializedObject[this.timestampPath];
            }

            delete materializedObject[this.timestampPath];
        }
        return materializedObject;
    }

    protected async handleValue(value: any, prevId: string, relation: string, index: number): Promise<any> {
        let res;
        if (typeof value === "object"
            && (value['value']
                || value['@value']
                || value['https://parktrack.geosparc.com/parkingBay/status#value'])) {
            // TODO use language, datetime property etc
            const v = value['value'] ? value['value']
                : value['@value'] ? value['@value']
                    : value['https://parktrack.geosparc.com/parkingBay/status#value'];

            res = {
                "type": "Property",
                value: v
            };
        } else if (typeof value === "object" &&
            relation !== "@type" &&
            relation !== "type"
        ) {
            let id = this.getIdFromValue(value, prevId, relation, index);
            // make sure value has an identifier
            if (!value["id"] && !value["@id"]) {
                value["id"] = id
            };

            // If isVersionOf, materialize object with observedAt
            if (value[this.versionOfPath]) {
                value = this.materializeObject(value);
                // Update with materialized ID
                id = value["id"];
            }

            if (value["type"] || value["@type"]) {
                // create new result from this object and return the relationship
                const newResult = await this.handleRoot(value);
                if (newResult && (newResult["type"] || newResult["@type"])) {
                    this.resultArray.push(newResult);
                }
            }

            res = {
                "type": "Relationship",
                object: id,
            };
        } else if (typeof value === "string" && value.startsWith('http')) {
            res = {
                "type": "Relationship",
                object: value,
            };
        } else if (typeof value === "string" &&
            relation !== "@type" &&
            relation !== "type") {
            // create new property from this string and return the value
            res = {
                "type": "Property",
                value: value,
            };
        } else {
            res = value;
        }

        // Tag with temporal property if any
        if (this.observedAt) {
            res['observedAt'] = this.observedAt;
        }
        return res;
    }

    protected getIdFromValue(value: any, prevId: string, relation: string, index: number): string {
        let id = '';
        if (typeof value === "string") id = value;
        // value is only a string
        else if (value['id'] && value['id']['id']) id = value['id']['id'];
        else if (value['@id'] && value['@id']['@id']) id = value['@id']['@id'];
        else if (value["@id"]) id = value["@id"];
        else if (value["id"]) id = value["id"];
        else id = prevId + "/" + relation.toLowerCase() + "/" + index;

        return id;
    }

    private removeCRS(v: string): string {
        if (v.indexOf('<') != -1 && v.indexOf('>') != -1) {
            return v.replace(v.substring(v.indexOf('<'), v.indexOf('>') + 2), '');
        } else {
            return v;
        }
    }
}

