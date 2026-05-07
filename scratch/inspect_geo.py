import json

with open('frontend/public/mexico_geo.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

features = data.get('features', [])
tp = data.get('type', 'unknown')
print(f'Type: {tp}')
print(f'Features: {len(features)}')
print('First 5 state names and properties:')
for feat in features[:5]:
    props = feat.get('properties', {})
    print(f'  {props}')
