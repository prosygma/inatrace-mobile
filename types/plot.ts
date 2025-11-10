export interface Plot {
  id: string;
  plotName: string;
  crop: string;
  numberOfPlants: number;
  size: string;
  geoId: string;
  certification: string;
  organicStartOfTransition: string;
  featureInfo: FeatureInfo;
  centerLatitude: number;
  centerLongitude: number;
}

export interface FeatureInfo {
  type: 'Feature';
  properties: any;
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}
