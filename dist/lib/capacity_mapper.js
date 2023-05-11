"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCapacity = void 0;
// Adapts the output in order to override how capacity is presented.
// Certain integrations are limited to using capacity as a direct property of BycicleParkingStation.
const mapCapacity = (rootObjects) => {
    var _a;
    // find the root (BycicleParkingStation) object
    const station = rootObjects.find((obj) => obj["type"] ===
        "https://smartdatamodels.org/dataModel.OSLO/BicycleParkingStation");
    if (!station) {
        // oups, nothing we can do
        return rootObjects;
    }
    // find the id of the capacity relationship
    const capacityId = (_a = station["https://smartdatamodels.org/dataModel.OSLO/ParkingFacility.capacity"]) === null || _a === void 0 ? void 0 : _a.object;
    if (!capacityId) {
        // oups, nothing we can do
        return rootObjects;
    }
    const capacity = rootObjects.find((obj) => obj["id"] === capacityId);
    if (!capacity) {
        // oups, nothing we can do
        return rootObjects;
    }
    const capacityProperty = {
        "type": "Property",
        "value": {
            "type": "https://smartdatamodels.org/dataModel.OSLO/Capacity",
            "https://smartdatamodels.org/dataModel.OSLO/Capacity.total": capacity["https://smartdatamodels.org/dataModel.OSLO/Capacity.total"],
            "observedAt": capacity["observedAt"]
        },
        "observedAt": capacity["observedAt"]
    };
    if (!capacityProperty) {
        // oups, nothing we can do
        return rootObjects;
    }
    // replace the relationshiop in the root object
    station["https://smartdatamodels.org/dataModel.OSLO/ParkingFacility.capacity"] = Object.assign({}, capacityProperty);
    // return all members excluding the capacity
    return rootObjects.filter((obj) => obj["id"] !== capacityId);
};
exports.mapCapacity = mapCapacity;
//# sourceMappingURL=capacity_mapper.js.map