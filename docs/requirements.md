4. Functional Requirements
Authentication

The system should allow customers to:

Register
Login
Logout
Access their profile
Access protected resources

Admins should have separate authorization privileges.

Product Catalog

Customers should be able to:

View products
View product details
Search products
Filter products
View product availability

Each product should contain information such as:

Product
├── ID
├── Name
├── Description
├── Price
├── Category
├── Stock quantity
├── Image
└── Created/updated timestamps
Shopping Cart

Customers should be able to:

Add products
Remove products
Change quantity
View cart
See total price

The backend must validate:

Requested quantity <= available inventory
Orders

Customers should be able to:

Place an order
View order details
View previous orders
See order status

Example:

PENDING
   ↓
CONFIRMED
   ↓
PROCESSING
   ↓
SHIPPED
   ↓
DELIVERED

We can also support:

CANCELLED
4. Admin Requirements

Admins can:

Products
Create product
Update product
Delete product
View products
Inventory
View stock
Update stock
Orders
View orders
View order details
Update order status
5. Non-Functional Requirements

This is where our project becomes production-oriented.

Scalability

The application should be capable of handling increasing traffic without redesigning the entire system.

Availability

We should avoid having a single server become a complete point of failure.

Security

We will implement:

HTTPS
Authentication
Authorization
Secure secrets
IAM least privilege
Input validation
Database security
Network isolation
Performance

We will eventually use:

CloudFront
    ↓
Caching
    ↓
Application
    ↓
Redis
    ↓
Database
Observability

We should be able to answer:

"What happened when the application failed?"

Therefore we'll eventually implement:

Application logs
Infrastructure logs
Metrics
Health checks
Alarms
6. DevOps Requirements

Our application must be deployable automatically.

Target workflow:

Developer
    ↓
Git commit
    ↓
GitHub
    ↓
CI Pipeline
    ├── Tests
    ├── Lint
    ├── Build
    └── Security checks
            ↓
        Docker Image
            ↓
           ECR
            ↓
        Deployment
            ↓
           AWS

Infrastructure will be managed using:

Terraform

rather than manually creating everything through the AWS console.

7. Environments

We'll eventually have:

Development
     ↓
Staging
     ↓
Production

For now, we'll primarily work locally.

Later we'll introduce AWS environments progressively.

8. Initial Scope

We're deliberately not building Amazon-level functionality.

Version 1
Customer
├── Registration/Login
├── Product catalog
├── Product search/filter
├── Cart
├── Checkout
└── Orders

Admin
├── Dashboard
├── Product management
├── Inventory management
└── Order management
Later enhancements

Once the core platform works, we can add:

Payment integration
Email notifications
Product reviews
Coupons
Recommendations
Advanced search
Analytics
Auto scaling
Blue/green deployment
Disaster recovery
Load testing
Security scanning