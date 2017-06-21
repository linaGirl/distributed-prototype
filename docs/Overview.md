# Distributed Framework

A framework for Microservices based on a simple standard

Components: 

- Basic Services: services can implement resources and actions on them
- Relationl Services: relational services define relations betwenn resources in a standardized way
- Related Services: are services that work on top of the related orm. they can creatre a restful interface for your existing db on the fly

- Resources: resource provide functionality via exposable actions
- RelationResources: are resources that are related to other resources
- RelateResource: are resources basing on the Related orm

- Request: requests that can be sent to other services
- Relational Requests: requests that can be used to query relational resources
- Response: responeses received from 

- APIGateway: a prebuilt multiprocess HTTP to Distributed request gateway service


Additional Features:
- Permissions Management
- Rate Limits
- Test Infrstructure for simplifier test driven development