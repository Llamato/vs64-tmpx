//
// Dwarf String Offset Table
//

//-----------------------------------------------------------------------------------------------//
// Init module
//-----------------------------------------------------------------------------------------------//
// eslint-disable-next-line
BIND(module);

//-----------------------------------------------------------------------------------------------//
// Required Modules
//-----------------------------------------------------------------------------------------------//

const { ElfSection } = require('elf/section');

//-----------------------------------------------------------------------------------------------//
// String Offset Table Section
//-----------------------------------------------------------------------------------------------//

class DwarfStringOffsetTableSection extends ElfSection {
    constructor(sectionHeader) {
        super(sectionHeader);

        this._table = this.#decodeOffsetTable();
    }

    get(index) {
        const tab = this._table;
        if (!tab || index >= tab.length) return null;
        return tab[index];
    }

    #decodeOffsetTable() {

        const deserializer = this.getDeserializer();

        const unitHeader = deserializer.readDwarfUnitHeader();
        if (unitHeader.version != 5) {
            throw("DWARF version != 5 is not supported");
        }

        const unit = {};
        unit.header = unitHeader;

        const _padding_ = deserializer.read16();

        const offsets = [];

        while (deserializer.ofs < unitHeader.endOfs) {
            const offset = deserializer.readOffs();
            offsets.push(offset);
        }

        return offsets;
    }
}

//-----------------------------------------------------------------------------------------------//
// Module Exports
//-----------------------------------------------------------------------------------------------//

module.exports = {
    DwarfStringOffsetTableSection: DwarfStringOffsetTableSection
}
