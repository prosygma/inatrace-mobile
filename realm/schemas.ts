export const PlotSchema = {
  name: 'Plot',
  properties: {
    id: 'string',
    farmerId: 'string',
    userId: 'string',
    data: 'string',
    synced: 'bool',
  },
  primaryKey: 'id',
};

export const FarmerSchema = {
  name: 'Farmer',
  properties: {
    id: 'string',
    userId: 'string',
    companyId: 'string',
    data: 'string',
    name: 'string',
    surname: 'string',
    synced: 'bool',
  },
  primaryKey: 'id',
};
