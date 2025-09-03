# Updating the Schema

## Idea
Our goal is to better understand and structure the indexed data stored in the database.  
We will continue storing raw data, but also parse it to gain deeper insights. Based on this parsed data, we’ll design new tables and columns that can be efficiently consumed by the application. Which will be used to display different metrics & insights about the blockchain.

To support this, we’ll:  
- Update the indexing logic to align with the new schema for incoming data (future blocks).  
- Create a transformation script to parse and backfill data from previously indexed raw records.  

I'll need you to come to best approach for acheving this so we do a good job of it. Ask questions if needed. I'd not want any discrepancy. Both the transformed (backfilled) data and newly indexed data must strictly align with the new schema.  

## Rough Procedure
During this phase, we will:  
1. List all existing entities in the database.  
2. For each entity:  
   a. Examine current data structures.  
   b. Develop a detailed understanding of them.  
   c. Update the schema
   d. Then:  
      i. Update the indexing logic to accommodate the new schema.  
      ii. Extend the transformation script to backfill historical data as per schema update   
