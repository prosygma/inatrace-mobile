export interface User {
  id: number;
  email: string;
  name: string;
  surname: string;
  status: string;
  role: string;
  language: string;
  actions: string[];
  companyIds: number[];
  companyIdsAdmin: number[];
}
