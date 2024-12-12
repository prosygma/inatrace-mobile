import { Plot } from './plot';

export interface Farmer {
  id: number | string;
  companyId: number;
  farmerCompanyInternalId: string;
  type: string;
  name: string;
  surname: string;
  phone: string;
  email?: string;
  hasSmartphone: boolean;
  location: {
    address: {
      cell?: string;
      sector?: string;
      village?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      hondurasFarm?: string;
      hondurasVillage?: string;
      hondurasMunicipality?: string;
      hondurasDepartment?: string;
      otherAddress?: string;
      country: {
        id: number;
        code: string;
        name: string;
      };
    };
  };
  gender: string;
  bank: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    additionalInformation: string;
  };
  farm: {
    areaUnit: string;
    totalCultivatedArea: number;
    farmPlantInformationList: Array<{
      productType: {
        id: number;
        name: string;
        code: string;
        description: string;
      };
      plantCultivatedArea: number;
      numberOfPlants: number;
    }>;
    organic: boolean;
    areaOrganicCertified: number;
    startTransitionToOrganic: string;
  };
  associations: Array<any>;
  cooperatives: Array<{
    id: number;
    userCustomer: {
      id: number;
    };
    company: {
      id: number;
      name: string;
    };
    userCustomerType: string;
  }>;
  certifications: Array<any>;
  productTypes: Array<{
    id: number;
    name: string;
    code: string;
    description: string;
  }>;
  plots: Plot[];
}

export interface ProductTypeWithCompanyId {
  companyId: number;
  productTypes: ProductType[];
}

export interface ProductType {
  id: number;
  name: string;
  code: string;
  description: string;
}
