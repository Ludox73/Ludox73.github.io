I made SMALL changes in story.html, basically to change the names of the md files to something that reflects the order in which they appear. It works.

Here some thing to do:

"Indistinguishable example":
    - I changed "fast mode" to "Score only". Maybe one can make it so that it is per default deselected. 
    - I wrote some blah blah to be included in the subpanel "Motif frequency in isomelodic example". It is called 05-iso-frequency.md 

In the text after "Indistinguishable" I changed the color of the links because they were highly unreadable. I was unable to find a color matching that of the other highlighted text (e.g. the theorems)

In "Orthospectrum Estimation" one needs to split the md file and add a figure (the initial CDF) between both.

In "Intersection distribution" one needs a button to generate the geodesic.

--------------------------------------

Orange to blue in sum CDF


Motif Frequency Estimation:
    -Put a button to "run geodesic" to get data (say length 250.000)
    -In estimation of 2/3 motifs, 
    	- In estimation 2-motifs, replace a with "gap between notes"
        - In estimation 3-motifs replace "a", "b" by , "first gap", "second gap"
        - instead of \epsilon write "tolerance". 
        - Write "Preselected motifs" next to the buttons 1-10.
        - Instead of "run" label the button by "Estimate frequency"
        - Before the buttons/ledger, write "Setect _motif_"
        - Between the buttons/ledge and the button, maybe write "Pressing _Estimate frequency_ you get the numerical estimate of the _frequency_ of the chosen _motif_, and a diagram showing how this estimate varies over time."
        - Put the default of the gap and notes to the first preselected motif.
        - Get rid of "total geodesic length" (and maybe note and motif count).
	- instead of 3.6520e-3 write 0.36520 % (per cent)

Compare two surfaces:
    - Compare motifs: to speed it up, maybe set the length to be 250.000 (or maybe 500.000) instead of a 1.000.000.

Indistinguishable examples
    - " " -> "Error"
    - TEXT in Motif Frequency: 
        Given that errors becomes clearly visible when one rans for such a model length like $50$, you might be wondering why do we bother to use lengths like $1.000.000$, and what is the value of our calculations. Well, note that since the errors are really small for relatively long times (length $25$), the curves we describe, while not geodesics are definitively _quasi-geodesics_ which moreover stay extremely close to the geodesic they track. Moreover, if the errors are random, as one probably should suppose them to be, then the so-obtained geodesics are also equidistributed with respect to the Liouville measure. It follows that while we might not be calculating the melody of the vector we start with, we are calculating, with small errors, the melody of some other random vector. 

        To exhibit this phenomenon we compare the numerical estimation of _frequencies of motifs_ in our two non-isometric isomelodic marimbas.

Orthospectrum estimation:
    - Put a button to calculate music here
    - Remove Guess sep/nonsep
    - Maybe only allow to run "Estimate Next Element" until say 100.000 arcs are left (that seems to be where it stops working nicely when I try)
